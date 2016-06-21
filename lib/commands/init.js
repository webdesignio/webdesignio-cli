'use strict'

const { writeFileSync } = require('fs')
const { join } = require('path')
const request = require('request')
const unzip = require('unzip')
const { mv, rm, ls, cd, exec, chmod } = require('shelljs')
const chalk = require('chalk')

const { UserError } = require('../errors')

module.exports = init

function init ({ argv: { _: [, name] } }, next) {
  if (!name) return next(new UserError('A `name` is required'))
  console.log('      Fetching skeleton ...')
  new Promise((resolve, reject) => {
    request('https://github.com/webdesignio/skeleton/archive/master.zip')
      .pipe(unzip.Extract({ path: name }))
      .on('error', reject)
      .on('close', resolve)
  })
  .then(() => {
    console.log('      Extracting sources ...')
    const files = ls('-A', join(name, 'skeleton-master'))
      .map(p => join(name, 'skeleton-master', p))
    mv(files, name)
    rm('-r', join(name, 'skeleton-master'))
    cd(name)
    chmod('+x', 'scripts/*')
    const pkg = require(`${process.cwd()}/package.json`)
    pkg.name = name
    writeFileSync('package.json', JSON.stringify(pkg, null, 2))
    console.log('      Installing dependencies (be patient) ...')
    exec('npm install', { silent: true })
    next(
      null,
      'Successfully initialized ' +
      name +
      '\n      Use ' + chalk.cyan('`npm start`') +
      ' to get up and running'
    )
  })
  .catch(next)
}
