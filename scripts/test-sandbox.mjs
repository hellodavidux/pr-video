#!/usr/bin/env node
/**
 * Run: node scripts/test-sandbox.mjs
 * Tests the full fetch → sandbox pipeline against cal-simple PR #1.
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

// Load .env manually
try {
  const env = readFileSync(resolve(root, '.env'), 'utf8')
  for (const line of env.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim()
  }
} catch {}

// Shim import.meta.env for Vite modules
const envShim = {
  env: {
    VITE_GITHUB_TOKEN: process.env.VITE_GITHUB_TOKEN ?? '',
    VITE_ANTHROPIC_KEY: process.env.VITE_ANTHROPIC_KEY ?? '',
  },
}

// Dynamic import with import.meta shim won't work in node directly.
// Inline the pipeline test instead.

const owner = 'hellodavidux'
const repo = 'cal-simple'
const headSha = '9c554990f85ce9a88ccefe33c65bcce95c642ae3'
const headers = { Accept: 'application/vnd.github+json' }
if (process.env.VITE_GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.VITE_GITHUB_TOKEN}`
}

async function fetchFile(path) {
  const variants = [path, path + '.tsx', path + '.ts', path + '.jsx', path + '.js']
  for (const v of variants) {
    const r = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${v}?ref=${headSha}`,
      { headers },
    )
    if (!r.ok) continue
    const d = await r.json()
    if (d.content) return { path: v, source: Buffer.from(d.content, 'base64').toString('utf8') }
  }
  return null
}

const prFiles = await fetch(
  `https://api.github.com/repos/${owner}/${repo}/pulls/1/files?per_page=100`,
  { headers },
).then((r) => r.json())

const changed = prFiles.filter((f) => /\.(jsx?|tsx?)$/.test(f.filename))
const files = new Map()
for (const f of changed) {
  const item = await fetchFile(f.filename)
  if (item) files.set('/' + item.path, item.source)
}

console.log('Files fetched:', files.size)
console.log('Paths:', [...files.keys()].join(', '))

// Build App.tsx like buildSandbox does
const component = { path: '/src/components/TeamAvailabilityTable.tsx', name: 'TeamAvailabilityTable', kind: 'named' }
const src = files.get(component.path)
console.log('\nComponent source length:', src?.length)
console.log('Has export:', src?.includes('export function TeamAvailabilityTable'))

const importPath = `.${component.path.replace(/^\/src/, '').replace(/\.(tsx|ts|jsx|js)$/, '')}`
const appTsx = `import { ${component.name} } from '${importPath}';
import './index.css';

export default function App() {
  return (
    <div className="min-h-screen bg-cal-bg p-6" style={{ minHeight: '100vh' }}>
      <${component.name} />
    </div>
  );
}
`

console.log('\n--- Generated App.tsx ---')
console.log(appTsx)

// Check imports in TeamAvailabilityTable
const importRe = /from\s+['"]([^'"]+)['"]/g
const imports = []
let m
while ((m = importRe.exec(src)) !== null) imports.push(m[1])
console.log('\nComponent imports:', imports)

for (const imp of imports) {
  if (imp.startsWith('.')) {
    const resolved = imp.replace(/^\.\//, 'src/components/').replace(/^\.\.\//, 'src/')
    const found = [...files.keys()].some((k) => k.includes(imp.split('/').pop().replace(/\.tsx?$/, '')))
    console.log(`  ${imp} → in bundle: ${found}`)
  }
}
