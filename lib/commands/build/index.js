'use strict'

const { fork } = require('child_process')

module.exports = build

function build ({ rc }) {
  const env = Object.assign({}, process.env, {
    NODE_ENV: 'production',
    WEBDESIGNIO_CLUSTER_URL: (rc.url || '').replace(/\/+$/, '')
  })
  fork(`${__dirname}/build_components`, { env })
  fork(`${__dirname}/build_templates`, { env })
  fork(`${__dirname}/build_bundles`, { env })
}
