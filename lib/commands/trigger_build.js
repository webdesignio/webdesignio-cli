'use strict'

const request = require('request-then')

const { UserError } = require('../errors')

module.exports = triggerBuild

function triggerBuild ({ rc: { id, token, url } }, next) {
  if (!url) return next(new UserError('An `url` is required'))
  request({
    url: `${url}/api/v1/websites/build`,
    qs: { website: id },
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    json: true
  })
  .then(res =>
    (res.statusCode / 100 | 0) === 2
      ? res.body
      : Promise.reject(new UserError(res.body.message))
  )
  .then(() =>
    next(null, 'Successfully created build-job!')
  )
  .catch(next)
}
