'use strict'

const fs = require('fs')
const ora = require('ora')
const read = require('read')
const request = require('request-then')
const toPascalCase = require('to-pascal-case')

const { UserError } = require('./errors')

module.exports = {
  login,
  deploy
}

function login ({ argv: { _: [, url] } }, next) {
  if (!url) return next(new UserError('An `url` is required'))
  read({
    prompt: 'The website identifier [e.g. my-site]: '
  }, (err, id) => {
    console.log()
    if (!id) return next(new UserError('No identifier given!'))
    if (err) return next(err)
    const rc = { url, id }
    fs.writeFileSync('.wdiorc.json', JSON.stringify(rc, null, 2))
    next(null, 'Successfully logged in!')
  })
}

function deploy ({ rc: { url, id } }, next) {
  if (!url) return next(new UserError('You need to login before deployment'))
  const spinner = ora({
    text: 'Collecting sources',
    spinner: 'arrow3'
  }).start()
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
  const allFiles = fs.readdirSync('.')
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
  request({
    method: 'POST',
    url: `${url}/api/v1/websites/${id}/deploy`,
    formData: allFiles
      .reduce(
        (files, { name, path }) =>
          Object.assign({}, files, { [name]: fs.createReadStream(path) })
        ,
        {}
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
