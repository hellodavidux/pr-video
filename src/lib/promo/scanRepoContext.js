import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, relative } from 'path'

const ASSET_DIRS = ['src/assets', 'public', 'assets']
const DATA_DIRS = ['src/data', 'data']
const VIDEO_DIRS = ['src/videos', 'src/remotion']
const THEME_CANDIDATES = [
  'src/styles/theme.ts',
  'src/styles/theme.js',
  'src/theme.ts',
  'src/theme.js',
  'src/index.css',
  'src/App.css',
]

function walkFiles(dir, root, acc = []) {
  if (!existsSync(dir)) return acc
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue
      walkFiles(full, root, acc)
    } else {
      acc.push(relative(root, full))
    }
  }
  return acc
}

function readIfExists(root, relPath) {
  const full = join(root, relPath)
  if (!existsSync(full)) return null
  try {
    return readFileSync(full, 'utf8')
  } catch {
    return null
  }
}

/**
 * Scan the local repo for Remotion templates, assets, product data, and theme hints.
 */
export function scanRepoContext(root) {
  const assets = []
  for (const dir of ASSET_DIRS) {
    assets.push(...walkFiles(join(root, dir), root).filter((p) => /\.(png|jpe?g|svg|webp|gif|mp4|webm)$/i.test(p)))
  }

  const dataFiles = []
  for (const dir of DATA_DIRS) {
    dataFiles.push(...walkFiles(join(root, dir), root).filter((p) => /\.json$/i.test(p)))
  }

  const remotionFiles = []
  for (const dir of VIDEO_DIRS) {
    remotionFiles.push(
      ...walkFiles(join(root, dir), root).filter((p) => /\.(jsx?|tsx?)$/.test(p)),
    )
  }

  const themePath = THEME_CANDIDATES.find((p) => existsSync(join(root, p)))
  const themeSource = themePath ? readIfExists(root, themePath) : null

  const brandHints = {}
  if (themeSource) {
    const primary =
      themeSource.match(/primary(?:Color)?\s*[:=]\s*['"](#[^'"]+)['"]/i)?.[1] ??
      themeSource.match(/--color-(?:primary|brand|accent):\s*([^;]+);/)?.[1]?.trim()
    const font =
      themeSource.match(/font(?:Family)?\s*[:=]\s*['"]([^'"]+)['"]/i)?.[1] ??
      themeSource.match(/--font-(?:sans|body):\s*([^;]+);/)?.[1]?.trim()
    if (primary) brandHints.primaryColor = primary
    if (font) brandHints.font = font.replace(/['"]/g, '').split(',')[0].trim()
  }

  return {
    assets,
    dataFiles,
    remotionFiles,
    themePath,
    brandHints,
    themeSnippet: themeSource ? themeSource.slice(0, 2000) : null,
  }
}
