#!/usr/bin/env node

const fs = require('fs')
const chalk = require('chalk')
const yargs = require('yargs')

const commands = require('../lib/commands')

console.log()
console.log(chalk.bold.green('    web-design.io • commander'))
console.log(chalk.dim.green('      - ready to take off -'))
console.log()

const argv = yargs
  .usage('    $0 <command> [options] [args]')
  .command('deploy', 'Deploy the current website to a cluster')
  .command('login', 'Login to a web-design.io cluster')
  .command('build', 'Build the current website')
  .command('init', 'Initialize a new website')
  .command('trigger-build', 'Trigger a build job for the website')
  .command('push', 'Push local data to the cluster')
  .demand(1)
  .argv

const command = commands[argv._[0]]
if (!command) {
  yargs.showHelp()
  process.exit(1)
}
const ctx = { argv, rc: {} }
if (fs.existsSync('.webdesigniorc.json')) {
  ctx.rc = require(`${process.cwd()}/.webdesigniorc.json`)
}
command(ctx, done)

function done (err, msg) {
  if (err) {
    console.log('  ' + chalk.red(chalk.bold('⚠  [Error]  ') + err.message))
    console.log()
    console.log('    > Something went wrong, check the errors above and try again.')
    console.log('    > Let us know, if you know a better error message.')
    console.log('    > ' + chalk.cyan.underline('https://github.com/webdesignio/webdesignio-cli'))
    console.log()
    process.exit(1)
  }
  if (msg) {
    console.log('    ' + chalk.green.bold('✓ ') + msg)
    console.log()
  }
}
