'use strict'

const { existsSync } = require('fs')
const { spawn } = require('child_process')
const { writeFile } = require('mz/fs')
const { join } = require('path')
const request = require('request')
const { mv, rm, ls, cd } = require('shelljs')
const chalk = require('chalk')
const ora = require('ora')
const co = require('co')
const surge = require('@webdesignio/surge-helper')
const Bluebird = require('bluebird')
const read = require('read')
const yn = require('yn')
const shortid = require('shortid')

const { UserError } = require('../errors')
const login = require('./login')

const readAsync = Bluebird.promisify(read)

module.exports = co.wrap(init)

function * init (ctx) {
  let { rc, argv: { _: [argv0, name] } } = ctx
  const spinner = ora({ spinner: 'arrow3', text: '...' })
  if (name) {
    if (!existsSync(name)) {
      spinner.start()
      yield new Promise((resolve, reject) => {
        spinner.text = 'Fetching boilerplate ...'
        const unzip = require('unzip')
        request('https://github.com/webdesignio/website-boilerplate/archive/master.zip')
          .pipe(unzip.Extract({ path: name }))
          .on('error', reject)
          .on('close', resolve)
      })
      spinner.text = 'Extracting sources ...'
      const files = ls('-A', join(name, 'website-boilerplate-master'))
        .map(p => join(name, 'website-boilerplate-master', p))
      mv(files, name)
      rm('-r', join(name, 'website-boilerplate-master'))
      spinner.stop()
    } else {
    }
    cd(name)
    try {
      rc = require(`${process.cwd()}/.webdesigniorc.json`)
    } catch (e) {}
  }
  console.log('    I need your credentials on https://webdesignio.com')
  console.log('    to log you in or register a brand-new account.')
  console.log()
  try {
    yield login(Object.assign({}, ctx, {
      rc,
      argv: { _: [argv0, 'https://webdesignio.com'] }
    }))
  } catch (e) {
    if (name) {
      console.log(
        '    > The login failed :(. To retry: ' +
        chalk.cyan('`cd`') + ' to ' + chalk.cyan(`\`${name}\``) +
        '\n    > and execute ' + chalk.cyan('`webdesignio init`') +
        ' without arguments.'
      )
      console.log()
    }
    throw e
  }
  const pkg = require(`${process.cwd()}/package.json`)
  pkg.name = rc.id
  yield writeFile('package.json', JSON.stringify(pkg, null, 2))
  if (!existsSync('node_modules')) {
    spinner.start()
    spinner.text = 'Installing dependencies (be patient) ...'
    yield new Promise((resolve, reject) => {
      spawn('npm', ['install'], { stdio: 'ignore' })
        .on('error', err => {
          spinner.stop()
          reject(err)
        })
        .on('close', code => {
          spinner.stop()
          if (code !== 0) {
            return reject(new UserError('npm failed -> Check the `npm-debug.log` file'))
          }
          resolve()
        })
    })
    spinner.stop()
  }
  let surgeConfig = yield surge.generateConfig()
  if (!surgeConfig) {
    console.log('    I couldn\'t find credentials for https://surge.sh.')
    console.log('    We currently use this service to publish your website,')
    console.log('    so you need an account.')
    console.log()
    console.log('    But no sweat if you don\'t have one.')
    console.log('    I can easily manage this for you!')
    console.log()
    const [answer] = yield readAsync({
      prompt: 'Do you want to login or create an account on https://surge.sh?',
      default: 'y'
    })
    const yes = yn(answer)
    console.log()
    if (yes) yield surge.login()
    surgeConfig = yield surge.generateConfig()
    if (!surgeConfig) {
      console.log('     I still couldn\'t detect the surge credentials.')
      console.log('     But don\'t give up, yet. Just try to edit the config manually afterwards.')
      console.log()
    }
  }
  rc.config = rc.config || {}
  rc.config.driver = 'surge'
  rc.config.surge = surgeConfig || {}
  if (!rc.config.domain) {
    console.log('    Tell me your domain on surge. You can use `{{language}}`')
    console.log('    as language placeholder (e.g. `{{language}}.mysite.com`).')
    console.log()
    console.log('    You don\'t know what I\'m talkin\' about? No problem!')
    console.log('    Then just leave this field empty')
    console.log('    and I will generate a domain for you!')
    console.log()
    const defaultDomain = rc.id + '-' + shortid().toLowerCase() + '-{{language}}.surge.sh'
    rc.config.domain = yield readAsync({
      prompt: 'Domain',
      default: defaultDomain
    })
    console.log()
  }
  yield writeFile(`${process.cwd()}/.webdesigniorc.json`, JSON.stringify(rc, null, 2))
  return (
    'Successfully initialized ' + rc.id +
    '\n      Use ' + chalk.cyan(`\`${name ? `cd ${name}; ` : ''}npm start\``) +
    ' to get up and running'
  )
}
