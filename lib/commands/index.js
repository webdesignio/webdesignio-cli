'use strict'

const login = require('./login')
const build = require('./build')
const init = require('./init')
const deploy = require('./deploy')
const triggerBuild = require('./trigger_build')

module.exports = {
  login,
  deploy,
  build,
  init,
  'trigger-build': triggerBuild
}
