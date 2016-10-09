'use strict'

const { parse: parseURL } = require('url')
const fs = require('fs')
const ora = require('ora')
const _request = require('request-then')
const toPascalCase = require('to-pascal-case')
const glob = require('glob')
const { ZipFile } = require('yazl')
const { walkSync } = require('file')
const co = require('co')
const chalk = require('chalk')
const { render } = require('mustache')

const { UserError } = require('../errors')
const build = require('./build')
const triggerBuild = require('./trigger_build')

module.exports = (ctx) =>
  build(ctx)
    .then(() => {
      console.log()
      return co.wrap(deploy)(ctx)
    })
    .then(() => triggerBuild(ctx))

function * deploy ({ rc: { url, id } }) {
  if (!url) throw new UserError('You need to login before deployment')
  const metaFiles = glob.sync('@(pages|objects)/*.meta.json')
  const allFiles = findSourceFiles('.')
  const { defaultLanguage, languages, noLangFields, globals } =
    JSON.parse(fs.readFileSync('package.json')).webdesignio
  if (!defaultLanguage || typeof defaultLanguage !== 'string') {
    throw new UserError('package.json: `defaultLanguage` needs to be a string')
  }
  if (!Array.isArray(languages)) {
    throw new UserError('package.json: `languages` needs to be an array')
  }
  if (languages.indexOf(defaultLanguage) === -1) {
    throw new UserError('package.json: `defaultLanguage` isn\'t included in `languages`')
  }
  if (!Array.isArray(noLangFields)) {
    throw new UserError('package.json: `noLangFields` needs to be an array')
  }
  if (!Array.isArray(globals)) {
    throw new UserError('package.json: `globals` needs to be an array')
  }

  // Try to read rc file
  let rc
  try {
    rc = JSON.parse(fs.readFileSync('.webdesigniorc.json')) || {}
  } catch (e) {
    rc = {}
  }
  const { token } = rc
  const config = rc.config || {}
  const spinner = ora({
    text: 'Updating website',
    spinner: 'arrow3'
  }).start()
  try {
    let res = yield request({
      method: 'PUT',
      url: `${url}/api/v1/websites`,
      qs: { website: id },
      headers: { authorization: `Bearer ${token}` },
      json: {
        defaultLanguage,
        languages,
        noLangFields,
        fieldKeys: globals,
        config
      }
    })
    spinner.text = 'Sending assets'
    const assets = zipAssets('static')
    yield new Promise((resolve, reject) =>
      assets.outputStream.pipe(fs.createWriteStream('assets.zip'))
        .on('error', reject)
        .on('close', resolve)
    )
    res = yield request({
      method: 'POST',
      url: `${url}/api/v1/assets`,
      qs: { website: id },
      headers: { authorization: `Bearer ${token}` },
      formData: { assets: fs.createReadStream('assets.zip') }
    })
    spinner.text = 'Uploading templates'
    res = yield request({
      method: 'POST',
      url: `${url}/api/v1/websites/deploy`,
      qs: { website: id },
      headers: { authorization: `Bearer ${token}` },
      formData:
        Object.assign(
          {},
          metaFiles
            .map(f => [f, JSON.stringify(JSON.parse(fs.readFileSync(f)))])
            .reduce(
              (files, f) => Object.assign({}, files, { [f[0]]: f[1] }),
              {}
            ),
          allFiles
            .reduce(
              (files, { name, path }) =>
                Object.assign({}, files, { [name]: fs.createReadStream(path) }),
              {}
            )
        )
    })
    const body = JSON.parse(res.body)
    const protocol = config.protocol || 'https'
    const parsedURL = parseURL(url)
    const websiteBackendURL = parsedURL.protocol + '//' + id + '.' + parsedURL.host
    spinner.stop()
    console.log(`    ${body.create} files created`)
    console.log(`    ${body.update} files updated`)
    console.log(`    ${body.remove} files removed`)
    console.log()
    console.log(`    ${chalk.green.bold('✓ ')}Successfully deployed to cluster ${chalk.cyan.underline(url)}!`)
    console.log()
    console.log(`    > Access the backend here: ${chalk.cyan.underline(websiteBackendURL)}`)
    if (config.domain) {
      console.log('    > Your website will be published at the following urls:')
      languages.forEach(language => {
        const url = `${protocol}://${render(config.domain, { language })}`
        console.log(`    >   - language ${chalk.bold.red(language)}: ${chalk.cyan.underline(url)}`)
      })
    }
    console.log()
  } catch (e) {
    spinner.stop()
    throw e
  }
}

function request (opts) {
  return _request(opts)
    .then(res => {
      if ((res.statusCode / 100 | 0) !== 2 && res.statusCode !== 500) {
        throw new UserError(res.body || res.statusMessage)
      } else if (res.statusCode === 500) {
        throw new UserError('An internal server error occured. Please try again later!')
      } else {
        return res
      }
    })
}

function findSourceFiles (dir) {
  const dirs = ['components', 'pages', 'objects']
  const files = ['client.js']
  const exts = {
    components: '.js',
    pages: '.html',
    objects: '.html'
  }
  const transforms = {
    components: toPascalCase
  }
  const transform = (type, c) =>
    (transforms[type] || (s => s))(
      c.split('.').slice(0, -1).join('')
    )
  return fs.readdirSync(dir)
    .filter(f => dirs.indexOf(f) !== -1 || files.indexOf(f) !== -1)
    .map(f =>
      dirs.indexOf(f) !== -1
        ? fs.readdirSync(f)
          .filter(c => c.endsWith(exts[f]))
          .map(c => ({
            name: `${f}/${transform(f, c)}`,
            path: `${f}/${c}`
          }))
        : [{ path: f, name: transform(null, f) }]
    )
    .reduce((files, f) => files.concat(f), [])
}

function zipAssets (path) {
  const zipFile = new ZipFile()
  walkSync(path, (start, dirs, files) => {
    files.forEach(f => {
      const absPath = `${start}/${f}`
      zipFile.addFile(absPath, absPath.slice(path.length + 1))
    })
  })
  zipFile.end()
  return zipFile
}
