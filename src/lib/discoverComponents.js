export function parseComponentExports(source) {
  const exports = []

  const defaultFn = source.match(/export\s+default\s+function\s+(\w+)/)
  if (defaultFn) exports.push({ name: defaultFn[1], kind: 'default' })

  const defaultClass = source.match(/export\s+default\s+class\s+(\w+)/)
  if (defaultClass) exports.push({ name: defaultClass[1], kind: 'default' })

  if (/export\s+default\s+\w+/.test(source) && exports.length === 0) {
    const m = source.match(/export\s+default\s+(\w+)/)
    if (m) exports.push({ name: m[1], kind: 'default' })
  }

  for (const m of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    if (/^[A-Z]/.test(m[1])) exports.push({ name: m[1], kind: 'named' })
  }

  for (const m of source.matchAll(/export\s+const\s+(\w+)\s*=/g)) {
    if (/^[A-Z]/.test(m[1])) exports.push({ name: m[1], kind: 'named' })
  }

  return exports
}

export function discoverComponents(files) {
  const components = []

  for (const [path, source] of files) {
    if (!/\/(components|pages|views|ui)\//i.test(path)) continue
    if (!/return\s*[<(]/.test(source)) continue

    const exports = parseComponentExports(source)
    for (const exp of exports) {
      components.push({ path, name: exp.name, kind: exp.kind, source })
    }
  }

  if (components.length === 0) {
    for (const [path, source] of files) {
      const exports = parseComponentExports(source)
      for (const exp of exports) {
        if (/^[A-Z]/.test(exp.name) && /return\s*[<(]/.test(source)) {
          components.push({ path, name: exp.name, kind: exp.kind, source })
        }
      }
    }
  }

  return components
}
