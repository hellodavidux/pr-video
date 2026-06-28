const PREVIEW_URL_PATTERNS = [
  /https:\/\/[\w-]+(?:--[\w-]+)?\.vercel\.app[^\s)"'<>]*/gi,
  /https:\/\/[\w-]+--[\w-]+\.netlify\.app[^\s)"'<>]*/gi,
  /https?:\/\/[\w.-]+\.pages\.dev[^\s)"'<>]*/gi,
  /https?:\/\/[\w.-]+\.web\.app[^\s)"'<>]*/gi,
  /https?:\/\/deploy-preview-\d+--[\w-]+\.netlify\.app[^\s)"'<>]*/gi,
]

const PREVIEW_LABEL_PATTERNS = [
  /(?:visit|view|open|check out|preview)(?:\s+the)?\s+preview(?:\s+at)?:?\s*(https?:\/\/[^\s)"'<>]+)/gi,
  /preview\s*url:?\s*(https?:\/\/[^\s)"'<>]+)/gi,
  /\[preview\]\((https?:\/\/[^)]+)\)/gi,
]

function cleanUrl(url) {
  return url.replace(/[.,;]+$/, '').replace(/\)$/, '')
}

export function extractPreviewUrl(body, comments = []) {
  const found = new Set()
  const texts = [body ?? '', ...comments.map((c) => c.body ?? '')]

  for (const text of texts) {
    for (const pattern of PREVIEW_URL_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        found.add(cleanUrl(match[0]))
      }
    }
    for (const pattern of PREVIEW_LABEL_PATTERNS) {
      for (const match of text.matchAll(pattern)) {
        found.add(cleanUrl(match[1]))
      }
    }
  }

  return [...found][0] ?? null
}
