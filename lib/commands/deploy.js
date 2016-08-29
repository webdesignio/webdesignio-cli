'use strict'

const fs = require('fs')
const ora = require('ora')
const request = require('request-then')
const toPascalCase = require('to-pascal-case')
const glob = require('glob')
const { ZipFile } = require('yazl')
const { walkSync } = require('file')

const { UserError } = require('../errors')

module.exports = deploy

function deploy ({ rc: { url, id } }, next) {
  if (!url) return next(new UserError('You need to login before deployment'))
  const metaFiles = glob.sync('@(pages|objects)/*.meta.json')
  const allFiles = findSourceFiles('.')
  const assets = zipAssets('static')
  const { defaultLanguage, languages, noLangFields, globals } =
    JSON.parse(fs.readFileSync('package.json')).webdesignio
  if (!defaultLanguage || typeof defaultLanguage !== 'string') {
    return next(new UserError('package.json: `defaultLanguage` needs to be a string'))
  }
  if (!Array.isArray(languages)) {
    return next(new UserError('package.json: `languages` needs to be an array'))
  }
  if (languages.indexOf(defaultLanguage) === -1) {
    return next(new UserError('package.json: `defaultLanguage` isn\'t included in `languages`'))
  }
  if (!Array.isArray(noLangFields)) {
    return next(new UserError('package.json: `noLangFields` needs to be an array'))
  }
  if (!Array.isArray(globals)) {
    return next(new UserError('package.json: `globals` needs to be an array'))
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
  assets.outputStream.pipe(fs.createWriteStream('assets.zip'))
    .on('error', next)
    .on('close', sendFiles)

  function sendFiles () {
    const spinner = ora({
      text: 'Uploading assets and templates',
      spinner: 'arrow3'
    }).start()
    request({
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
                Object.assign({}, files, { [name]: fs.createReadStream(path) })
              ,
              {}
            ),
          { assets: fs.createReadStream('assets.zip') }
        )
    })
    .then(res => {
      if (res.statusCode !== 200 && res.statusCode !== 500) {
        const body = JSON.parse(res.body)
        throw new UserError(body.message)
      } else if (res.statusCode === 500) {
        throw new UserError('An internal server error occured. Please try again later!')
      }
      const body = JSON.parse(res.body)
      spinner.stop()
      console.log(`    ${body.create} files created`)
      console.log(`    ${body.update} files updated`)
      console.log(`    ${body.remove} files removed`)
      console.log()
    })
    .then(() => {
      spinner.text = 'Updating website'
      spinner.start()
      return request({
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
    })
    .then(res => {
      spinner.stop()
      if ((res.statusCode / 100 | 0) !== 2 && res.statusCode !== 500) {
        const body = res.body
        throw new UserError(body.message)
      } else if (res.statusCode === 500) {
        throw new UserError('An internal server error occured. Please try again later!')
      }
      next(null, `Successfully deployed to cluster ${url}!`)
    })
    .catch(e => {
      spinner.stop()
      next(e)
    })
  }
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
