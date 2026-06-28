function parsePRUrl(url) {
  const u = new URL(url)
  const parts = u.pathname.replace(/^\//, '').split('/')
  const pullsIdx = parts.indexOf('pull')
  if (pullsIdx === -1 || !parts[pullsIdx + 1]) {
    throw new Error('Invalid PR URL — expected https://github.com/owner/repo/pull/123')
  }
  return {
    owner: parts[0],
    repo: parts[1],
    number: Number(parts[pullsIdx + 1]),
  }
}

function githubHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

/**
 * Fetch raw PR metadata from GitHub.
 */
export async function fetchPromoPR(prUrl, token) {
  const { owner, repo, number } = parsePRUrl(prUrl)
  const headers = githubHeaders(token)

  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, { headers })
  if (!res.ok) throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)

  const pr = await res.json()
  return {
    owner,
    repo,
    number,
    title: pr.title,
    description: pr.body || '',
    url: pr.html_url,
    headSha: pr.head?.sha,
    repoFull: `${owner}/${repo}`,
  }
}

/**
 * Normalize PR JSON payload or GitHub response into promo pipeline input.
 */
export function normalizePromoInput(input, repoContext = {}) {
  const title = input.title ?? 'Product Launch'
  const description = input.description ?? input.body ?? ''
  const features =
    input.features ??
  extractBulletFeatures(description)

  const brand = {
    primaryColor: input.brand?.primaryColor ?? repoContext.brandHints?.primaryColor ?? '#4F46E5',
    font: input.brand?.font ?? repoContext.brandHints?.font ?? 'Inter',
    cta: input.brand?.cta ?? 'Try it now',
  }

  const assets = input.assets ?? pickAssetsFromRepo(repoContext.assets)

  return {
    title,
    description,
    productName: input.productName ?? title.replace(/^launch:\s*/i, '').trim(),
    tagline: input.tagline ?? inferTagline(description, title),
    features: features.slice(0, 4),
    assets,
    brand,
    sourceUrl: input.url ?? null,
  }
}

function extractBulletFeatures(text) {
  const lines = String(text ?? '').split('\n')
  const bullets = lines
    .map((l) => l.trim())
    .filter((l) => /^[-*•]\s+/.test(l))
    .map((l) => l.replace(/^[-*•]\s+/, '').trim())
  if (bullets.length) return bullets

  const sentences = String(text ?? '')
    .replace(/\s+/g, ' ')
    .split(/[.!?]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8 && s.length < 80)
  return sentences.slice(0, 3)
}

function inferTagline(description, title) {
  const firstLine = String(description ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && !l.startsWith('-'))
  return firstLine ?? `Introducing ${title}`
}

function pickAssetsFromRepo(assetPaths) {
  const logo = assetPaths.find((p) => /logo/i.test(p))
  const screenshot = assetPaths.find((p) => /(screenshot|dashboard|preview|hero)/i.test(p))
  const picked = []
  if (logo) picked.push({ name: 'logo', path: logo })
  if (screenshot) picked.push({ name: 'screenshot', path: screenshot })
  return picked
}
