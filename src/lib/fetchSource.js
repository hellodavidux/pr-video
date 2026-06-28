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

const SOURCE_EXT = /\.(jsx?|tsx?)$/
const CODE_EXT = ['.tsx', '.ts', '.jsx', '.js']
const INDEX_EXT = CODE_EXT.map((e) => `/index${e}`)

function githubHeaders() {
  const token = import.meta.env.VITE_GITHUB_TOKEN
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

function decodeContent(data) {
  if (!data?.content) return null
  return atob(data.content.replace(/\n/g, ''))
}

function normPath(p) {
  const parts = p.split('/')
  const result = []
  for (const part of parts) {
    if (part === '..') result.pop()
    else if (part !== '.') result.push(part)
  }
  return result.join('/')
}

function computeRelative(fromPath, toPath) {
  const fromDir = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/')) : ''
  const from = fromDir ? fromDir.split('/') : []
  const to = toPath.replace(/^\//, '').split('/')
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  const rel = [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
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

function rewriteAliasImports(source, filePath) {
  const fileDir = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : ''
  return source.replace(/(['"])((?:@|~|#)\/[^'"]+)['"]/g, (_, q, importPath) => {
    for (const { prefix, root } of PATH_ALIASES) {
      if (importPath.startsWith(prefix)) {
        const absPath = root + importPath.slice(prefix.length)
        return `${q}${computeRelative(fileDir, absPath)}${q}`
      }
    }
    return `${q}${importPath}${q}`
  })
}

async function fetchRepoFile(owner, repo, repoPath, headSha, headers) {
  const variants = [repoPath, ...CODE_EXT.map((e) => repoPath + e), ...INDEX_EXT.map((e) => repoPath + e)]
  for (const path of variants) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${headSha}`,
        { headers },
      )
      if (!res.ok) continue
      const data = await res.json()
      const source = decodeContent(data)
      if (source) return { path, source }
    } catch {
      // try next variant
    }
  }
  return null
}

const UI_PATH_RE = /\/(components|pages|views|ui|features|screens)\//i
const APP_UI_RE = /^app\/[^/]+\.(jsx|tsx)$/

/**
 * Scan the repo's UI tree (not just PR diff) so the story planner sees where features live.
 */
export async function fetchRepoUISources(owner, repo, headSha, { maxFiles = 80 } = {}) {
  if (!headSha) return []

  const headers = githubHeaders()
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${headSha}?recursive=1`,
    { headers },
  )
  if (!res.ok) {
    console.warn('[fetchRepoUISources] Tree API failed:', res.status)
    return []
  }

  const tree = await res.json()
  const paths = (tree.tree ?? [])
    .filter((t) => t.type === 'blob' && SOURCE_EXT.test(t.path))
    .filter((t) => UI_PATH_RE.test(t.path) || APP_UI_RE.test(t.path))
    .map((t) => t.path)
    .slice(0, maxFiles)

  console.log('[fetchRepoUISources] UI paths found:', paths.length)

  const result = await Promise.all(
    paths.map(async (filename) => {
      const fetched = await fetchRepoFile(owner, repo, filename, headSha, headers)
      return fetched ? { filename: fetched.path, source: fetched.source, status: 'ui-scan' } : null
    }),
  )

  const valid = result.filter(Boolean)
  console.log('[fetchRepoUISources] Loaded:', valid.length, 'file(s)')
  return valid
}

/** Merge PR-changed sources over holistic UI scan (changed wins on path conflict). */
export function mergeUISources(uiFiles, changedFiles) {
  const byPath = new Map(uiFiles.map((f) => [f.filename, f]))
  for (const f of changedFiles ?? []) {
    if (f?.filename && f?.source) byPath.set(f.filename, f)
  }
  return [...byPath.values()]
}

export async function fetchPRFiles(owner, repo, prNumber, headSha) {
  const headers = githubHeaders()
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100`,
    { headers },
  )
  if (!res.ok) throw new Error(`GitHub files API error: ${res.status} ${res.statusText}`)

  const files = await res.json()
  const changed = files.filter((f) => SOURCE_EXT.test(f.filename))
  console.log('[fetchPRFiles] Changed source files:', changed.map((f) => f.filename))

  const result = await Promise.all(
    changed.map(async (f) => {
      let source = null

      if (headSha) {
        const fetched = await fetchRepoFile(owner, repo, f.filename, headSha, headers)
        source = fetched?.source ?? null
      }

      if (!source && f.patch) {
        source = f.patch
          .split('\n')
          .filter((l) => l.startsWith('+') && !l.startsWith('+++'))
          .map((l) => l.slice(1))
          .join('\n')
        console.log('[fetchPRFiles] Patch fallback for', f.filename)
      }

      return source ? { filename: f.filename, status: f.status, source } : null
    }),
  )

  const valid = result.filter(Boolean)
  console.log('[fetchPRFiles] Ready:', valid.map((f) => f.filename))
  return valid
}

/**
 * Pull in locally-imported UI files so the script planner can see modals/forms
 * referenced by changed pages (generic import closure, not repo-specific).
 */
export async function expandChangedFilesForPlanning(
  owner,
  repo,
  headSha,
  changedFiles,
  { maxFiles = 16 } = {},
) {
  if (!headSha || !changedFiles?.length) return changedFiles ?? []

  const headers = githubHeaders()
  const byPath = new Map(changedFiles.map((f) => [f.filename, f]))
  const queue = [...changedFiles]

  while (queue.length > 0 && byPath.size < maxFiles) {
    const file = queue.shift()
    if (!file?.source) continue

    for (const imp of parseImportPaths(file.source)) {
      const resolved = resolveToRepoPath(imp, file.filename)
      if (!resolved || byPath.has(resolved)) continue

      const fetched = await fetchRepoFile(owner, repo, resolved, headSha, headers)
      if (!fetched) continue

      const entry = { filename: fetched.path, source: fetched.source, status: 'planning-import' }
      byPath.set(fetched.path, entry)
      queue.push(entry)
    }
  }

  const expanded = [...byPath.values()]
  if (expanded.length > changedFiles.length) {
    console.log(
      '[fetchPRFiles] Planning catalog expanded:',
      expanded.length - changedFiles.length,
      'imported file(s)',
    )
  }
  return expanded
}

async function fetchPackageJson(owner, repo, headSha, headers) {
  const fetched = await fetchRepoFile(owner, repo, 'package.json', headSha, headers)
  if (!fetched) return null
  try {
    return JSON.parse(fetched.source)
  } catch {
    return null
  }
}

async function fetchGlobalCss(owner, repo, headSha, headers) {
  for (const candidate of CSS_CANDIDATES) {
    const fetched = await fetchRepoFile(owner, repo, candidate, headSha, headers)
    if (fetched) {
      console.log('[fetchSource] Global CSS:', fetched.path)
      return { path: fetched.path, source: fetched.source }
    }
  }
  return null
}

/**
 * Fetches PR source files, recursively resolves local imports, global CSS, and package.json.
 * Returns { files: Map<'/src/Foo.tsx', source>, css, dependencies }.
 */
export async function fetchSourceBundle(owner, repo, headSha, changedFiles, maxDepth = 5) {
  const headers = githubHeaders()
  const files = new Map()
  const queue = []
  const visited = new Set()

  for (const f of changedFiles) {
    const rewritten = rewriteAliasImports(f.source, f.filename)
    files.set(`/${f.filename}`, rewritten)
    visited.add(f.filename)
    queue.push({ repoPath: f.filename, source: f.source, depth: maxDepth })
  }

  while (queue.length > 0) {
    const { repoPath, source, depth } = queue.shift()
    if (depth <= 0) continue

    const imports = parseImportPaths(source)
    const toFetch = []

    for (const imp of imports) {
      const resolved = resolveToRepoPath(imp, repoPath)
      if (!resolved || visited.has(resolved)) continue
      visited.add(resolved)
      toFetch.push(resolved)
    }

    const fetched = await Promise.all(
      toFetch.map((p) => fetchRepoFile(owner, repo, p, headSha, headers)),
    )

    for (const item of fetched) {
      if (!item) continue
      const key = `/${item.path}`
      if (files.has(key)) continue
      const rewritten = rewriteAliasImports(item.source, item.path)
      files.set(key, rewritten)
      if (depth > 1) queue.push({ repoPath: item.path, source: item.source, depth: depth - 1 })
    }
  }

  const [css, packageJson] = await Promise.all([
    fetchGlobalCss(owner, repo, headSha, headers),
    fetchPackageJson(owner, repo, headSha, headers),
  ])

  const dependencies = {
    react: packageJson?.dependencies?.react ?? '^18.2.0',
    'react-dom': packageJson?.dependencies?.['react-dom'] ?? '^18.2.0',
  }

  // Collect npm deps referenced in fetched source
  const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g
  for (const source of files.values()) {
    let m
    while ((m = importRe.exec(source)) !== null) {
      const imp = m[1]
      if (imp.startsWith('.') || imp.startsWith('/')) continue
      const pkg = imp.startsWith('@')
        ? imp.split('/').slice(0, 2).join('/')
        : imp.split('/')[0]
      if (!pkg || pkg === 'next') continue
      if (!dependencies[pkg]) {
        dependencies[pkg] = packageJson?.dependencies?.[pkg] ?? 'latest'
      }
    }
  }

  console.log('[fetchSource] Bundle:', files.size, 'files, deps:', Object.keys(dependencies).join(', '))
  return { files, css, dependencies }
}
