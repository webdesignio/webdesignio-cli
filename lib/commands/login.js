'use strict'

const fs = require('fs')
const read = require('read')
const Bluebird = require('bluebird')
const request = require('request-then')

const { UserError } = require('../errors')

const readAsync = Bluebird.promisify(read)

module.exports = login

function login ({ rc = {}, argv: { _: [, url] } }, next) {
  if (!url) return next(new UserError('An `url` is required'))
  readAsync({ prompt: 'E-Mail: ' })
    .then(email =>
      readAsync({ prompt: 'Password: ', silent: true, replace: '*' })
        .then(password => {
          process.stdout.write('Fetching token ...')
          return password
        })
        .then(password =>
          request({
            url: `${url}/api/v1/tokens`,
            method: 'POST',
            json: { email, password }
          })
        )
        .then(res => {
          console.log(' done')
          console.log()
          return res
        })
    )
    .then(res =>
      (res.statusCode / 100 | 0) === 2
        ? res.body
        : Promise.reject(new UserError(res.body.message))
    )
    .then(({ token }) =>
      readAsync({ prompt: 'The website identifier [e.g. my-site]: ' })
        .then(id => {
          console.log()
          if (!id) throw new UserError('No identifier given!')
          fs.writeFileSync(
            '.webdesigniorc.json',
            JSON.stringify(
              Object.assign({}, rc, { url, id, token }),
              null,
              2
            )
          )
          next(null, 'Successfully logged in!')
        })
    )
    .catch(next)
}
