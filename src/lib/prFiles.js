const UI_EXTENSIONS = /\.(tsx|jsx|vue|svelte|css|scss|html|tsx\.css)$/i
const SKIP_PATTERNS = /\.(test|spec|stories|d\.ts|snap)\./i

export function isUIFile(filename) {
  if (!UI_EXTENSIONS.test(filename)) return false
  if (SKIP_PATTERNS.test(filename)) return false
  if (filename.includes('__tests__') || filename.includes('node_modules')) return false
  return true
}

export function isComponentFile(filename) {
  return isUIFile(filename) && /\.(tsx|jsx|vue|svelte)$/i.test(filename)
}

export function isReactComponentFile(filename) {
  return isComponentFile(filename) && /\.(tsx|jsx)$/i.test(filename)
}

export function isStyleFile(filename) {
  if (!/\.(css|scss|sass|less)$/i.test(filename)) return false
  if (SKIP_PATTERNS.test(filename)) return false
  return true
}

export function fileDisplayName(filename) {
  return filename.split('/').pop()
}

export function summarizePatch(patch) {
  if (!patch) return 'File modified'
  const added = patch.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length
  const removed = patch.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).length
  return `+${added} / -${removed} lines`
}

export function pickHighlightLines(patch, maxLines = 14) {
  if (!patch) return []

  const lines = patch.split('\n').filter((l) => !l.startsWith('@@'))
  const interesting = lines.filter(
    (l) => l.startsWith('+') || l.startsWith('-') || l.startsWith(' ')
  )

  return interesting.slice(0, maxLines).map((line) => ({
    text: line.slice(1),
    type: line.startsWith('+') ? 'add' : line.startsWith('-') ? 'remove' : 'context',
  }))
}
