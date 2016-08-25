'use strict'

const glob = require('glob')
const read = require('read')
const Bluebird = require('bluebird')
const request = require('request-then')
const yn = require('yn')

const { UserError } = require('../errors')

const readAsync = Bluebird.promisify(read)

module.exports = login

function login ({ rc: { id, token, url } }, next) {
  if (!id || !token) return next(new UserError('Login first'))
  readAsync({ prompt: 'This will overwrite any existing content! Continue? [y/n] ' })
    .then(sure =>
      !yn(sure)
        ? Promise.reject(new UserError('Canceled'))
        : null
    )
    .then(() =>
      Promise.all([
        Promise.all(
          glob.sync('data/pages/*.json')
            .map(file => require(process.cwd() + '/' + file))
            .map(o =>
              request({
                url: `${url}/api/v1/pages/${o._id}`,
                headers: { authorization: `Bearer ${token}` },
                qs: { website: id },
                method: 'PUT',
                json: o
              })
            )
        ),
        Promise.all(
          glob.sync('data/objects/*.json')
            .map(file => require(process.cwd() + '/' + file))
            .map(o =>
              request({
                url: `${url}/api/v1/objects/${o._id}`,
                headers: { authorization: `Bearer ${token}` },
                qs: { website: id },
                method: 'PUT',
                json: o
              })
            )
        ),
        Promise.resolve(require(process.cwd() + '/data/website.json'))
          .then(o =>
            request({
              url: `${url}/api/v1/websites`,
              headers: { authorization: `Bearer ${token}` },
              qs: { website: id },
              method: 'PUT',
              json: o
            })
          )
      ])
    )
    .then(ress =>
      ress.reduce((success, res) => (res.statusCode / 100 | 0) === 2, true)
        ? next(null, 'Successfully pushed local state')
        : Promise.reject(new UserError('The push failed!'))
    )
    .catch(next)
}
