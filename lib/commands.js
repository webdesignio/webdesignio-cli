'use strict'

const fs = require('fs')

const { UserError } = require('./errors')

module.exports = {
  login
}

function login ({ _: [, url] }, next) {
  if (!url) return next(new UserError('An `url` is required'))
  const rc = { url }
  fs.writeFileSync('.wdiorc', JSON.stringify(rc, null, 2))
  next()
}
