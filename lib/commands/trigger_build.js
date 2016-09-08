'use strict'

const request = require('request-then')
const co = require('co')

const { UserError } = require('../errors')

module.exports = co.wrap(triggerBuild)

function * triggerBuild ({ rc: { id, token, url } }) {
  if (!url) throw new UserError('An `url` is required')
  const res = yield request({
    url: `${url}/api/v1/websites/build`,
    qs: { website: id },
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    json: true
  })
  if ((res.statusCode / 100 | 0) === 2) return 'Successfully created build-job!'
  else throw new UserError(res.body || res.statusMessage)
}
