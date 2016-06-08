'use strict'

module.exports = {
  UserError
}

function UserError (msg) {
  const e = new Error(msg)
  e.name = 'UserError'
  return e
}
