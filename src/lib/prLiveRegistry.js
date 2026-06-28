import fs from 'fs'
import path from 'path'

function safeImportName(slideId) {
  return `Slide_${slideId.replace(/[^a-zA-Z0-9_]/g, '_')}`
}

/**
 * Lists slide directories under pr-live that have an entry.jsx file.
 */
export function listPrLiveSlideIds(prLiveDir) {
  if (!fs.existsSync(prLiveDir)) return []

  return fs
    .readdirSync(prLiveDir, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        fs.existsSync(path.join(prLiveDir, entry.name, 'entry.jsx')),
    )
    .map((entry) => entry.name)
    .sort()
}

/**
 * Writes src/remotion/prLiveRegistry.jsx with static imports for every pr-live
 * slide entry. Remotion and Vite both bundle this file — one path for preview
 * and MP4 export.
 */
export function writePrLiveRegistry({ prLiveDir, registryPath }) {
  const slideIds = listPrLiveSlideIds(prLiveDir)
  const version = Date.now()

  const importLines = slideIds
    .map((id) => `import ${safeImportName(id)} from './pr-live/${id}/entry.jsx'`)
    .join('\n')

  const registryEntries = slideIds
    .map((id) => `  '${id}': ${safeImportName(id)},`)
    .join('\n')

  const source = `/* Auto-generated — do not edit. Rebuilt when PR components are written. */
${importLines ? `${importLines}\n\n` : ''}export const PR_LIVE_REGISTRY_VERSION = ${version}

const REGISTRY = {
${registryEntries}
}

export function getPrLiveComponent(slideId) {
  return REGISTRY[slideId] ?? null
}

export function hasPrLiveComponent(slideId) {
  return Object.prototype.hasOwnProperty.call(REGISTRY, slideId)
}
`

  fs.mkdirSync(path.dirname(registryPath), { recursive: true })
  fs.writeFileSync(registryPath, source, 'utf8')

  return { version, slideIds }
}
