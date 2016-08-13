'use strict'

const login = require('./login')
const build = require('./build')
const init = require('./init')
const deploy = require('./deploy')

module.exports = {
  login,
  deploy,
  build,
  init
}
