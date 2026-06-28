import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { writePrLiveRegistry } from '../src/lib/prLiveRegistry.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

export const CAL_SIMPLE_DIR = path.join(ROOT, 'cal-simple')
const PR_LIVE_DIR = path.join(ROOT, 'src/remotion/pr-live')
const REGISTRY_PATH = path.join(ROOT, 'src/remotion/prLiveRegistry.jsx')

const PATH_ALIASES = [
  { prefix: '@/', root: 'src/' },
  { prefix: '~/', root: 'src/' },
  { prefix: '#/', root: 'src/' },
]

const CSS_CANDIDATES = [
  'src/index.css',
  'src/App.css',
  'src/styles.css',
  'app/globals.css',
  'styles/globals.css',
]

const CODE_EXT = ['.tsx', '.ts', '.jsx', '.js']
const INDEX_EXT = CODE_EXT.map((e) => `/index${e}`)
const SOURCE_EXT = /\.(jsx?|tsx?)$/

function normPath(p) {
  const parts = p.split('/')
  const result = []
  for (const part of parts) {
    if (part === '..') result.pop()
    else if (part !== '.') result.push(part)
  }
  return result.join('/')
}

function parseImportPaths(source) {
  const paths = new Set()
  const re = /(?:import|export)\s+(?:type\s+)?(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(source)) !== null) paths.add(m[1])
  return [...paths]
}

function resolveToRepoPath(importPath, fromFile) {
  for (const { prefix, root } of PATH_ALIASES) {
    if (importPath.startsWith(prefix)) return root + importPath.slice(prefix.length)
  }
  if (importPath.startsWith('.')) {
    const dir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : ''
    return normPath(dir ? `${dir}/${importPath}` : importPath)
  }
  return null
}

function readRepoFile(repoPath) {
  const variants = [repoPath, ...CODE_EXT.map((e) => repoPath + e), ...INDEX_EXT.map((e) => repoPath + e)]
  for (const candidate of variants) {
    const full = path.join(CAL_SIMPLE_DIR, candidate)
    if (fs.existsSync(full) && fs.statSync(full).isFile()) {
      return { path: candidate, source: fs.readFileSync(full, 'utf8') }
    }
  }
  return null
}

function walkSourceFiles(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSourceFiles(full, acc)
    } else if (SOURCE_EXT.test(entry.name)) {
      acc.push(path.relative(CAL_SIMPLE_DIR, full).replace(/\\/g, '/'))
    }
  }
  return acc
}

export function calSimpleExists() {
  return fs.existsSync(path.join(CAL_SIMPLE_DIR, 'src'))
}

function readGlobalCss() {
  for (const candidate of CSS_CANDIDATES) {
    const full = path.join(CAL_SIMPLE_DIR, candidate)
    if (fs.existsSync(full)) {
      return { path: candidate, source: fs.readFileSync(full, 'utf8') }
    }
  }
  return null
}

function readPackageJson() {
  const full = path.join(CAL_SIMPLE_DIR, 'package.json')
  if (!fs.existsSync(full)) return null
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'))
  } catch {
    return null
  }
}

/**
 * Build a source bundle from the local cal-simple folder (same shape as fetchSourceBundle).
 */
export function buildLocalSourceBundle({ seedPaths = null, maxDepth = 6 } = {}) {
  if (!calSimpleExists()) {
    throw new Error(`Local repo not found at ${CAL_SIMPLE_DIR}`)
  }

  const files = new Map()
  const visited = new Set()
  const queue = []

  const seeds =
    seedPaths ??
    walkSourceFiles(path.join(CAL_SIMPLE_DIR, 'src/features/ask-cal')).concat(
      walkSourceFiles(path.join(CAL_SIMPLE_DIR, 'src/components')),
    )

  if (seeds.length === 0) {
    walkSourceFiles(path.join(CAL_SIMPLE_DIR, 'src')).forEach((p) => seeds.push(p))
  }

  for (const repoPath of seeds) {
    const item = readRepoFile(repoPath)
    if (!item) continue
    files.set(`/${item.path}`, item.source)
    visited.add(item.path)
    queue.push({ repoPath: item.path, source: item.source, depth: maxDepth })
  }

  while (queue.length > 0) {
    const { repoPath, source, depth } = queue.shift()
    if (depth <= 0) continue

    for (const imp of parseImportPaths(source)) {
      const resolved = resolveToRepoPath(imp, repoPath)
      if (!resolved || visited.has(resolved)) continue
      visited.add(resolved)

      const item = readRepoFile(resolved)
      if (!item) continue

      const key = `/${item.path}`
      if (files.has(key)) continue
      files.set(key, item.source)
      queue.push({ repoPath: item.path, source: item.source, depth: depth - 1 })
    }
  }

  const css = readGlobalCss()
  const packageJson = readPackageJson()
  const dependencies = {
    react: packageJson?.dependencies?.react ?? '^19.0.0',
    'react-dom': packageJson?.dependencies?.['react-dom'] ?? '^19.0.0',
    'lucide-react': packageJson?.dependencies?.['lucide-react'] ?? 'latest',
  }

  const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g
  for (const source of files.values()) {
    let m
    while ((m = importRe.exec(source)) !== null) {
      const imp = m[1]
      if (imp.startsWith('.') || imp.startsWith('/')) continue
      const pkg = imp.startsWith('@') ? imp.split('/').slice(0, 2).join('/') : imp.split('/')[0]
      if (!pkg || pkg === 'next') continue
      if (!dependencies[pkg]) {
        dependencies[pkg] = packageJson?.dependencies?.[pkg] ?? 'latest'
      }
    }
  }

  console.log('[localRepo] Bundle:', files.size, 'files from', CAL_SIMPLE_DIR)
  return { files, css, dependencies }
}

export function writePrComponents(slideId, files) {
  const slideDir = path.join(PR_LIVE_DIR, slideId)
  fs.mkdirSync(slideDir, { recursive: true })

  for (const [relPath, source] of Object.entries(files)) {
    const dest = path.join(slideDir, relPath)
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, source, 'utf8')
  }
}

export function rebuildPrLiveRegistry() {
  return writePrLiveRegistry({ prLiveDir: PR_LIVE_DIR, registryPath: REGISTRY_PATH })
}

export function serializeBundle(bundle) {
  return {
    files: Object.fromEntries(bundle.files),
    css: bundle.css,
    dependencies: bundle.dependencies,
  }
}

export function deserializeBundle(data) {
  return {
    files: new Map(Object.entries(data.files ?? {})),
    css: data.css ?? null,
    dependencies: data.dependencies ?? {},
  }
}
