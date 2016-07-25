'use strict'

const fs = require('fs')
const ora = require('ora')
const request = require('request-then')
const toPascalCase = require('to-pascal-case')
const glob = require('glob')

const { UserError } = require('../errors')

module.exports = deploy

function deploy ({ rc: { url, id } }, next) {
  if (!url) return next(new UserError('You need to login before deployment'))
  const spinner = ora({
    text: 'Collecting sources',
    spinner: 'arrow3'
  }).start()
  const metaFiles = glob.sync('@(pages|objects)/*.meta.json')
  const allFiles = findSourceFiles('.')
  const { defaultLanguage, languages, noLangFields, globals: fields } =
    JSON.parse(fs.readFileSync('package.json')).wdio
  request({
    method: 'POST',
    url: `${url}/api/v1/websites/${id}/deploy`,
    formData:
      Object.assign(
        {},
        {
          website: JSON.stringify({
            defaultLanguage,
            languages,
            noLangFields,
            fields
          })
        },
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
          )
      )
  })
  .then(res => {
    spinner.stop()
    if (res.statusCode !== 200 && res.statusCode !== 500) {
      const body = JSON.parse(res.body)
      return next(new UserError(body.message))
    } else if (res.statusCode === 500) {
      next(new UserError('An internal server error occured. Please try again later!'))
      return
    }
    const body = JSON.parse(res.body)
    console.log(`    ${body.create} files created`)
    console.log(`    ${body.update} files updated`)
    console.log(`    ${body.remove} files removed`)
    console.log()
    next(null, `Successfully deployed to ${url}!`)
  })
  .catch(e => {
    spinner.stop()
    next(e)
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