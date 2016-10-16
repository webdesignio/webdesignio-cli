#!/usr/bin/env node

const fs = require('fs')
const { spawn } = require('child_process')
const { resolve } = require('path')
const chalk = require('chalk')
const minimist = require('minimist')

console.log()
console.log(chalk.bold.green('    web-design.io • commander'))
console.log(chalk.dim.green('      - ready to take off -'))
console.log()

const argv = minimist(process.argv.slice(2))

const commands = new Set(['pull'])
if (commands.has(argv._[0])) {
  const bin = resolve(__dirname, `webdesignio-${argv._[0]}`)
  const proc = spawn(bin, process.argv.slice(3), { stdio: 'inherit' })
  proc.on('error', e => done(e))
  proc.on('close', code => process.exit(code))
} else {
  const command = require('../lib/commands')[argv._[0]]
  if (!command) {
    console.log(
`    Usage:

      $ webdesignio <command> [options] [args]

    Commands:
      deploy         Deploy the current website to a cluster
      login          Login to a web-design.io cluster
      build          Build the current website
      init           Initialize a new website
      trigger-build  Trigger a build job for the website
      push           Push local data to the cluster
      pull           Pull the remote data to the local database
`
    )
    process.exit(1)
  } else {
    const ctx = { argv, rc: {} }
    if (fs.existsSync('.webdesigniorc.json')) {
      ctx.rc = require(`${process.cwd()}/.webdesigniorc.json`)
    }
    const maybePromise = command(ctx, done)
    if (maybePromise && (typeof maybePromise.then) === 'function') {
      maybePromise.then(msg => done(null, msg), err => done(err))
    }
  }
}

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
