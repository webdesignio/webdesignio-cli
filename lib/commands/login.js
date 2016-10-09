'use strict'

const { parse: parseURL } = require('url')
const { writeFile } = require('mz/fs')
const read = require('read')
const Bluebird = require('bluebird')
const request = require('request-then')
const co = require('co')
const chalk = require('chalk')
const yn = require('yn')

const { UserError } = require('../errors')

const readAsync = Bluebird.promisify(read)

module.exports = co.wrap(login)

function * login ({ rc = {}, argv: { _: [, url], identifier } }) {
  const parsedURL = parseURL(url)
  if (!url) return Promise.reject(new UserError('An `url` is required'))
  const email = yield readAsync({ prompt: 'E-Mail: ' })
  const password = yield readAsync({ prompt: 'Password: ', silent: true, replace: '*' })
  rc.url = url
  process.stdout.write('Attempting registration ...')
  const registrationRes = yield request({
    url: `${url}/api/v1/users`,
    method: 'POST',
    json: { email, password }
  })
  if (registrationRes.statusCode === 201) {
    console.log(' registered')
  } else if (registrationRes.statusCode !== 409) {
    console.log(' fail')
    throw new UserError(registrationRes.body || registrationRes.statusMessage)
  } else {
    console.log(' exists')
  }
  process.stdout.write('Fetching token ...')
  const res = yield request({
    url: `${url}/api/v1/tokens`,
    method: 'POST',
    json: { email, password }
  })
  console.log(' done')
  console.log()
  if ((res.statusCode / 100 | 0) !== 2) {
    throw new UserError(res.body || res.statusMessage)
  }
  rc.token = res.body.token
  let id = rc.id
  if (!id) {
    console.log(
      '    Now I need the website identifier. ' +
      chalk.yellow.bold('This identifier must be unique') +
      '.'
    )
    console.log('    It\'s the name of your website\'s subdomain.')
    console.log(
      '    (e.g. ' + chalk.cyan.bold(identifier || 'my-awesome-website') +
      ' which would up in ' +
      chalk.cyan.underline(
        parsedURL.protocol + '//' +
        chalk.bold(identifier || 'my-awesome-website') + '.' +
        parsedURL.host
      ) + ').'
    )
    let retry = false
    do {
      console.log()
      id = yield readAsync({ prompt: 'Identifier', default: identifier })
      const res = yield request({
        url: `${url}/api/v2/websites/${id}`,
        headers: { Authorization: `Bearer ${rc.token}` }
      })
      if ((res.statusCode / 100 | 0) === 2) {
        console.log()
        console.log('    ' + chalk.yellow.bold('Caution the website identifier is already taken!'))
        if (res.statusCode === 204) {
          console.log(
            '    ' +
            chalk.yellow.bold('You don\'t have access to the website ') +
            chalk.cyan.bold(id) + '.'
          )
        }
        console.log()
        const a = yield readAsync({ prompt: 'Change the identifier?', default: 'y' })
        retry = yn(a)
      } else {
        retry = false
      }
    } while (retry)
  }
  if (!id) throw new UserError('No identifier given!')
  rc.id = id
  yield writeFile('.webdesigniorc.json', JSON.stringify(rc, null, 2))
  return 'Successfully logged in!'
}
