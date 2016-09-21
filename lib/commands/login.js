'use strict'

const { writeFile } = require('mz/fs')
const read = require('read')
const Bluebird = require('bluebird')
const request = require('request-then')
const co = require('co')

const { UserError } = require('../errors')

const readAsync = Bluebird.promisify(read)

module.exports = co.wrap(login)

function * login ({ rc = {}, argv: { _: [, url] } }) {
  if (!url) return Promise.reject(new UserError('An `url` is required'))
  const email = yield readAsync({ prompt: 'E-Mail: ' })
  const password = yield readAsync({ prompt: 'Password: ', silent: true, replace: '*' })
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
  const { token } = res.body
  let id = rc.id
  if (!id) {
    id = yield readAsync({ prompt: 'The website identifier [e.g. my-site]: ' })
    console.log()
  }
  if (!id) throw new UserError('No identifier given!')
  Object.assign(rc, { url, id, token })
  yield writeFile(
    '.webdesigniorc.json',
    JSON.stringify(rc, null, 2)
  )
  return 'Successfully logged in!'
}
