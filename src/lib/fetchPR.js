import { extractPreviewUrl } from './extractPreviewUrl'

function githubHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function githubFetch(url, token) {
  const res = await fetch(url, { headers: githubHeaders(token) })
  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`)
  }
  return res.json()
}

async function fetchPRFiles(owner, repo, pullNumber, token) {
  const files = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/files?per_page=100`,
    token
  )

  return files.map((f) => ({
    filename: f.filename,
    status: f.status,
    additions: f.additions,
    deletions: f.deletions,
    patch: f.patch ?? null,
    blobUrl: f.blob_url,
  }))
}

async function fetchPRComments(owner, repo, pullNumber, token) {
  const comments = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${pullNumber}/comments?per_page=100`,
    token
  )
  return comments.map((c) => ({ body: c.body, author: c.user.login }))
}

async function fetchCheckRunPreview(owner, repo, ref, token) {
  try {
    const data = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${ref}/check-runs?per_page=30`,
      token
    )

    for (const run of data.check_runs ?? []) {
      if (run.details_url && /\.(vercel\.app|netlify\.app|pages\.dev)/i.test(run.details_url)) {
        return run.details_url
      }
      const fromOutput = extractPreviewUrl(run.output?.summary ?? '', [])
      if (fromOutput) return fromOutput
    }
  } catch {
    // Check runs may require repo scope
  }
  return null
}

async function fetchDeploymentPreview(owner, repo, token) {
  try {
    const deployments = await githubFetch(
      `https://api.github.com/repos/${owner}/${repo}/deployments?environment=Preview&per_page=10`,
      token
    )

    for (const deployment of deployments) {
      const statuses = await githubFetch(
        `https://api.github.com/repos/${owner}/${repo}/deployments/${deployment.id}/statuses?per_page=5`,
        token
      )
      const success = statuses.find((s) => s.state === 'success' && s.environment_url)
      if (success?.environment_url) return success.environment_url
    }
  } catch {
    // Deployments API may be unavailable without permissions
  }
  return null
}

export async function fetchLatestOpenPR(repoUrl) {
  const token = import.meta.env.VITE_GITHUB_TOKEN
  const pathname = new URL(repoUrl).pathname.replace(/^\//, '').replace(/\/$/, '')
  const [owner, repo] = pathname.split('/')

  if (!owner || !repo) {
    throw new Error('Invalid GitHub URL — expected https://github.com/owner/repo')
  }

  const pulls = await githubFetch(
    `https://api.github.com/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=1`,
    token
  )

  const open = pulls[0]
  if (!open) throw new Error('No open PRs found in this repo')

  const [files, comments, deploymentUrl, checkRunUrl] = await Promise.all([
    fetchPRFiles(owner, repo, open.number, token),
    fetchPRComments(owner, repo, open.number, token),
    fetchDeploymentPreview(owner, repo, token),
    fetchCheckRunPreview(owner, repo, open.head.sha, token),
  ])

  const previewUrl =
    extractPreviewUrl(open.body, comments) ?? checkRunUrl ?? deploymentUrl ?? null

  return {
    number: open.number,
    title: open.title,
    body: open.body || '(no description)',
    author: open.user.login,
    updated_at: open.updated_at,
    url: open.html_url,
    repo: `${owner}/${repo}`,
    owner,
    repoName: repo,
    headRef: open.head.ref,
    baseRef: open.base.ref,
    files,
    comments,
    previewUrl,
  }
}
