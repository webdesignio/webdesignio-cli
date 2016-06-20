'use strict'

const { join } = require('path')
const request = require('request')
const unzip = require('unzip')
const { mv, rm, ls, cd, exec, chmod } = require('shelljs')
const chalk = require('chalk')

module.exports = init

function init ({ argv: { _: [, name] } }, next) {
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
