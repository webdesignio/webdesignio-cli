'use strict'

const { exec } = require('shelljs')

module.exports = build

function build (ctx) {
  let pkg
  try {
    pkg = require(`${process.cwd()}/package.json`)
  } catch (e) {
    pkg = {}
  }
  pkg.scripts = pkg.scripts || {}
  if (pkg.scripts.build) exec('npm run build')
  return Promise.resolve('Successfully built website!')
}
