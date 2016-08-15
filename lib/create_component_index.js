#!/usr/bin/env node

'use strict'

const builtinTransforms = require('./builtin_transforms')

module.exports = createComponentIndex

function createComponentIndex ({ components }) {
  const componentInfos = Object.keys(components)
    .map(name => {
      const path = getComponentPath(components[name])
      const opts = getComponentOpts(components[name])
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
    })
  const transforms = componentInfos
    .reduce((transforms, info) =>
      info.opts.transform
        ? transforms
          .concat(
            info.opts
              .transform
              .filter(t => transforms.indexOf(t) === -1)
          )
        : transforms,
      []
    )
  const transformAliases = transforms
    .reduce(
      (aliases, t, i) => Object.assign({}, aliases, { [t]: `t${i}` }),
      {}
    )
  const transformDefs = transforms
    .map(t => genTransformDef(transformAliases[t], t))
    .filter(t => !!t)
  const imports = transforms
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
  return `${componentInfos
    .map((info, i) =>
      `import C${i} from '${info.path}'`
    )
    .join('\n')}
${imports}
${transformDefs
  .map(d => d.def)
  .join('\n')}
export default {
  ${componentInfos
    .map((info, i) =>
      `'${info.name}': ${
        genApplyCode(
          (info.opts.transform || [])
            .map(t => transformAliases[t]),
          `C${i}`
        )
      },`
    )
    .join('\n  ')}
}`
}

function genTransformImport (name, path) {
  if (!builtinTransforms[path]) {
    return `import { dom as ${name} } from '${path}'`
  }
  return null
}

function genTransformDef (name, path) {
  if (builtinTransforms[path]) {
    const transform = builtinTransforms[path]
    return {
      def: `const ${name} = ${transform.dom.toString()}`,
      imports: builtinTransforms[path].imports.dom
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
