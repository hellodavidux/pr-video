const MARKDOWN_IMAGE = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
const HTML_IMAGE = /<img[^>]+src=["']([^"']+)["']/gi
const GITHUB_ASSET = /https:\/\/(?:user-images\.githubusercontent\.com|github\.com\/user-attachments\/assets)[^\s)"']+/g

export function extractPRImages(body) {
  const found = new Set()

  for (const match of body.matchAll(MARKDOWN_IMAGE)) found.add(match[1])
  for (const match of body.matchAll(HTML_IMAGE)) found.add(match[1])
  for (const match of body.matchAll(GITHUB_ASSET)) found.add(match[0])

  return [...found].filter((url) => /^https?:\/\//i.test(url))
}
