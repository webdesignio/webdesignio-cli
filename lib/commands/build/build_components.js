'use strict'

const { writeFile } = require('fs')
const { dirname } = require('path')
const babel = require('babel-core')
const glob = require('glob')
const Bluebird = require('bluebird')
const mkdirp = require('mkdirp')
const parser = require('shift-parser')
const codegen = require('shift-codegen').default
const browserify = require('browserify')
const chalk = require('chalk')

const createComponentProxy = require('../../create_component_proxy')
const pkg = require(`${process.cwd()}/package.json`)

const writeFileAsync = Bluebird.promisify(writeFile)
const babelAsync = Bluebird.promisify(babel.transformFile)
const mkdirpAsync = Bluebird.promisify(mkdirp)

const transpiledPath = 'components/browserify/transpiled'
const files = glob.sync('src/components/**/*.@(js|jsx)')
  .filter(p => p !== 'src/components/index.js')
const targets = files.map(f =>
  f.replace(/^src\/components/, transpiledPath)
)
const components = () => (pkg.webdesignio || {}).components || {}
Promise.all(
  files.map((file, i) =>
    mkdirpAsync(dirname(targets[i]))
      .then(() => babelAsync(file, { presets: ['react'] }))
      .then(({ code }) => writeFileAsync(targets[i], code))
  )
)
.then(() =>
  console.log(chalk.green.bold('    ✓ ') + 'All components transpiled')
)
.then(() =>
  Promise.all(
    Object.keys(components())
      .map(name => {
        return writeFileAsync(
          `components/browserify/${name}.js`,
          createComponentProxy({ components: components(), name })
        )
        .then(() => {
          return bundleComponent({
            name,
            input: `components/browserify/${name}.js`,
            output: `components/${name}.js`
          })
        })
      })
  )
)
.then(() =>
  console.log(chalk.green.bold('    ✓ ') + 'All components compiled')
)
.catch(err => { console.error(err.stack) })

function bundleComponent ({ name, input, output }) {
  return new Promise((resolve, reject) => {
    browserify(input, { transform: ['rollupify'], standalone: name })
      .bundle((err, buf) => {
        if (err) return reject(err)
        const ast = parser.parseScript(buf.toString())
        resolve(codegen(ast))
      })
  })
  .then(source => writeFileAsync(output, source))
}
