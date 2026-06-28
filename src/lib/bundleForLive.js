/**
 * Bundles fetched PR source files into a single react-live snippet.
 * Avoids Sandpack iframes which fail to paint inside Remotion.
 */

function parseImportPaths(source) {
  const paths = []
  const re = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(source)) !== null) paths.push(m[1])
  return paths
}

function normImportPath(fromDir, importPath) {
  const base = fromDir ? `${fromDir}/${importPath}` : importPath
  const parts = base.split('/')
  const result = []
  for (const part of parts) {
    if (part === '..') result.pop()
    else if (part !== '.') result.push(part)
  }
  return result.join('/')
}

function findInClosure(closure, repoPath) {
  const candidates = [
    `/${repoPath}`,
    `/${repoPath}.tsx`,
    `/${repoPath}.ts`,
    `/${repoPath}.jsx`,
    `/${repoPath}.js`,
  ]
  for (const c of candidates) {
    if (closure.has(c)) return c
  }
  return null
}

export function collectClosure(files, entryPath) {
  const closure = new Map()
  const queue = [entryPath]
  const seen = new Set()

  while (queue.length > 0) {
    const current = queue.shift()
    if (seen.has(current)) continue
    seen.add(current)

    const source = files.get(current)
    if (!source) continue
    closure.set(current, source)

    const dir = current.replace(/^\//, '')
    const fileDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : ''

    for (const imp of parseImportPaths(source)) {
      if (!imp.startsWith('.')) continue
      const resolved = findInClosure(files, normImportPath(fileDir, imp))
      if (resolved && !seen.has(resolved)) queue.push(resolved)
    }
  }

  return closure
}

function orderFiles(closure, entryPath) {
  const order = []
  const seen = new Set()

  function visit(path) {
    if (seen.has(path)) return
    seen.add(path)
    const source = closure.get(path)
    if (!source) return

    const dir = path.replace(/^\//, '')
    const fileDir = dir.includes('/') ? dir.slice(0, dir.lastIndexOf('/')) : ''

    for (const imp of parseImportPaths(source)) {
      if (!imp.startsWith('.')) continue
      const resolved = findInClosure(closure, normImportPath(fileDir, imp))
      if (resolved) visit(resolved)
    }
    order.push(path)
  }

  visit(entryPath)
  return order
}

function stripImports(source) {
  return source
    .replace(/^\s*import\s+type\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?/gm, '')
    .replace(/^\s*import\s+[\s\S]*?\s+from\s+['"][^'"]+['"]\s*;?/gm, '')
}

function stripExports(source) {
  return source
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+/gm, '')
}

function collectNpmSymbols(closure) {
  const lucide = new Set()
  const re = /import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"]lucide-react['"]/g
  for (const source of closure.values()) {
    let m
    while ((m = re.exec(source)) !== null) {
      for (const sym of m[1].split(',')) {
        const name = sym.trim().split(/\s+as\s+/)[0].trim()
        if (name && name !== 'type') lucide.add(name)
      }
    }
  }
  return { lucide: [...lucide] }
}

function inferMockProps(source, componentName) {
  const props = {}
  const typeMatch = source.match(
    new RegExp(`type\\s+${componentName}Props\\s*=\\s*\\{([^}]+)\\}`, 's'),
  )
  const destructureMatch = source.match(
    new RegExp(`function\\s+${componentName}\\s*\\(\\s*\\{([^}]+)\\}`, 's'),
  )
  const raw = typeMatch?.[1] ?? destructureMatch?.[1] ?? ''
  if (!raw) return props

  for (const key of raw.split(',').map((p) => p.trim().split(':')[0].split('?')[0].split('=')[0].trim()).filter(Boolean)) {
    if (key.startsWith('on') || key.startsWith('handle')) props[key] = '() => {}'
    else if (key === 'open' || key === 'isOpen' || key === 'visible' || key === 'show') props[key] = 'true'
    else if (/teammates|items|data|rows|options|schedules|redirects|list/i.test(key)) props[key] = '[]'
    else props[key] = 'undefined'
  }
  return props
}

function formatProps(props) {
  const entries = Object.entries(props)
  if (entries.length === 0) return ''
  return ` ${entries.map(([k, v]) => `${k}={${v}}`).join(' ')}`
}

export function bundleForLive(files, component) {
  const closure = collectClosure(files, component.path)
  const ordered = orderFiles(closure, component.path)
  const npm = collectNpmSymbols(closure)

  const parts = ordered.map((path) => stripExports(stripImports(closure.get(path))))
  const props = formatProps(inferMockProps(component.source, component.name))
  parts.push(`render(<div className="min-h-screen bg-cal-bg p-6" style={{ minHeight: '100vh' }}><${component.name}${props} /></div>);`)

  return {
    code: parts.join('\n\n'),
    lucideIcons: npm.lucide,
  }
}
