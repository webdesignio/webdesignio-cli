'use strict'

const fs = require('fs')
const ora = require('ora')

const { UserError } = require('./errors')

module.exports = {
  login,
  deploy
}

function login ({ argv: { _: [, url] } }, next) {
  if (!url) return next(new UserError('An `url` is required'))
  const rc = { url }
  fs.writeFileSync('.wdiorc.json', JSON.stringify(rc, null, 2))
  next(null, 'Successfully logged in!')
}

function deploy ({ rc: { url } }, next) {
  if (!url) return next(new UserError('You need to login before deployment'))
  const spinner = ora({
    text: `Contacting ${url}`,
    spinner: 'arrow3'
  }).start()
  setTimeout(() => {
    spinner.color = 'yellow'
    spinner.text = `Deploying to ${url}`
    setTimeout(() => {
      spinner.stop()
      next(null, `Successfully deployed to ${url}!`)
    }, 5000)
  }, 5000)
}
