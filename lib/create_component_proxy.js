#!/usr/bin/env node

'use strict'

const { join } = require('path')
const builtinTransforms = require('./builtin_transforms')

module.exports = printProxy

function createComponentInfo ({ components, name }) {
  const component = components[name]
  const path = getComponentPath(component)
  const opts = getComponentOpts(component)
  try {
    const pkgJson = require(`${path}/package.json`)
    return {
      name,
      path,
      opts: Object.assign({}, opts, pkgJson.webdesignio || {})
    }
  } catch (e) {
    return { name, path, opts }
  }
}

function transforms ({ componentInfo }) {
  return componentInfo.opts.transform || []
}

function transformAliases ({ transforms }) {
  return transforms
    .reduce(
      (aliases, t, i) => Object.assign({}, aliases, { [t]: `t${i}` }),
      {}
    )
}

function transformDefs ({ transforms, transformAliases }) {
  return transforms
    .map(t => genTransformDef(transformAliases[t], t))
    .filter(t => !!t)
}

function imports ({ transforms, transformDefs, transformAliases }) {
  return transforms
    .map(t => genTransformImport(transformAliases[t], t))
    .filter(t => !!t)
    .concat(
      transformDefs
        .reduce(
          (ims, def) =>
            ims.concat(
              def.imports.filter(i => !containsImport(ims, i))
            ),
          []
        )
        .map(i => `import ${i[0]} from '${i[1]}'`)
    )
    .join('\n')
}

function proxy ({ imports, componentInfo, transforms, transformDefs, transformAliases }) {
  return `${imports}
import C from '${
  componentInfo.path.startsWith('.')
    ? ('./' + join('transpiled', componentInfo.path))
    : componentInfo.path
}'
${transformDefs
  .map(d => d.def)
  .join('\n')}
module.exports = ${
  genApplyCode(transforms.map(t => transformAliases[t]), 'C')
}`
}

function genTransformImport (name, path) {
  if (!builtinTransforms[path]) {
    return `import { string as ${name} } from '${
      path.startsWith('.')
        ? './' + join('transpiled', path)
        : path
    }'`
  }
  return null
}

function genTransformDef (name, path) {
  if (builtinTransforms[path]) {
    const transform = builtinTransforms[path]
    return {
      def: `const ${name} = ${transform.string.toString()}`,
      imports: builtinTransforms[path].imports.string
    }
  }
  return null
}

function genApplyCode (fns, arg) {
  const fnCode = fns.reduce((code, fn) => `${code}${fn}(`, '')
  const closingBrackets = fns.reduce(code => `${code})`, '')
  return `${fnCode}${arg}${closingBrackets}`
}

function getComponentPath (o) {
  return typeof o === 'string'
    ? o
    : o[0]
}

function getComponentOpts (o) {
  return typeof o === 'string'
    ? {}
    : o[1]
}

function containsImport (imports, i) {
  return imports.reduce((contains, _i) =>
    contains || (_i[0] === i[0] && _i[1] === i[1]),
    false
  )
}

function printProxy ({ components, name }) {
  const componentInfo = createComponentInfo({ components, name })
  const trs = transforms({ componentInfo })
  const tras = transformAliases({ transforms: trs })
  const trds = transformDefs({ transforms: trs, transformAliases: tras })
  return proxy({
    imports: imports({
      transforms: trs,
      transformDefs: trds,
      transformAliases: tras
    }),
    componentInfo,
    transforms: trs,
    transformDefs: trds,
    transformAliases: tras
  })
}
