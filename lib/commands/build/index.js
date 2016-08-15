'use strict'

const { fork } = require('child_process')

module.exports = build

function build () {
  const config =
    require(`${process.cwd()}/.webdesigniorc.json`) || {}
  const env = Object.assign({}, process.env, {
    NODE_ENV: 'production',
    WEBDESIGNIO_CLUSTER_URL: (config.url || '').replace(/\/+$/, '')
  })
  fork(`${__dirname}/build_components`, { env })
  fork(`${__dirname}/build_templates`, { env })
  fork(`${__dirname}/build_bundles`, { env })
}
