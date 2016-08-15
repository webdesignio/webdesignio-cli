'use strict'

const { writeFileSync, writeFile } = require('fs')
const browserify = require('browserify')
const uglify = require('uglify-js')
const Bluebird = require('bluebird')
const chalk = require('chalk')

const createComponentIndex = require('../../create_component_index')
const pkg = require(`${process.cwd()}/package.json`)

const writeFileAsync = Bluebird.promisify(writeFile)
const components = (pkg.webdesignio || {}).components || {}
const bundles = ['client.js']
writeFileSync(
  'src/components/index.js',
  createComponentIndex({ components })
)

Promise.all(
  bundles.map(name =>
    new Promise((resolve, reject) => {
      browserify(`src/${name}`)
        .transform('babelify', { presets: ['react', 'es2015'] })
        .transform('envify')
        .bundle((err, buf) => {
          if (err) return reject(err)
          let source
          try {
            source = uglify.minify(buf.toString(), { fromString: true })
          } catch (e) {
            return reject(e)
          }
          resolve(source.code)
        })
    })
    .then(source => writeFileAsync(`static/${name}`, source))
  )
)
.then(() => console.log(chalk.green.bold('    ✓ ') + 'All bundles built'))
.catch(e => console.error(e.stack))
