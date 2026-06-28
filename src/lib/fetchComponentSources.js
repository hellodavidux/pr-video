import { isReactComponentFile, isStyleFile } from './prFiles'

function githubHeaders(token) {
  const headers = { Accept: 'application/vnd.github+json' }
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function fetchRawFile(owner, repo, path, ref, token) {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(ref)}`,
    { headers: githubHeaders(token) }
  )

  if (!res.ok) {
    throw new Error(`Could not load ${path} (${res.status})`)
  }

  const data = await res.json()
  if (data.encoding !== 'base64' || !data.content) {
    throw new Error(`Unexpected content format for ${path}`)
  }

  const binary = atob(data.content.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

async function loadFiles(pr, files, token) {
  const loaded = []
  for (const file of files) {
    try {
      const source = await fetchRawFile(pr.owner, pr.repoName, file.filename, pr.headRef, token)
      loaded.push({ ...file, source })
    } catch (err) {
      loaded.push({ ...file, source: null, loadError: err.message })
    }
  }
  return loaded
}

export async function fetchUISources(pr, { componentLimit = 6, styleLimit = 4 } = {}) {
  const token = import.meta.env.VITE_GITHUB_TOKEN
  const components = (pr.files ?? [])
    .filter((f) => isReactComponentFile(f.filename))
    .slice(0, componentLimit)
  const styles = (pr.files ?? [])
    .filter((f) => isStyleFile(f.filename))
    .slice(0, styleLimit)

  const componentSources = await loadFiles(pr, components, token)
  const styleSources = await loadFiles(pr, styles, token)

  return { componentSources, styleSources }
}

/** @deprecated use fetchUISources */
export async function fetchComponentSources(pr, limit = 6) {
  const { componentSources } = await fetchUISources(pr, { componentLimit: limit, styleLimit: 0 })
  return componentSources
}
