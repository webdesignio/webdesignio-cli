'use strict'

const fs = require('fs')
const read = require('read')

const { UserError } = require('../errors')
const build = require('./build')
const init = require('./init')
const deploy = require('./deploy')

module.exports = {
  login,
  deploy,
  build,
  init
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
    fs.writeFileSync('.webdesigniorc.json', JSON.stringify(rc, null, 2))
    next(null, 'Successfully logged in!')
  })
}
