/**
 * Client helpers for the local cal-simple repo (served via /api/local-repo/*).
 */

export const LOCAL_REPO_NAME = 'cal-simple'

export function useLocalRepo() {
  const flag = import.meta.env.VITE_USE_LOCAL_REPO
  if (flag === 'false' || flag === '0') return false
  return true
}

export async function fetchLocalSourceBundle() {
  const res = await fetch('/api/local-repo/bundle')
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Local repo bundle failed (${res.status}): ${err}`)
  }

  const data = await res.json()
  return {
    files: new Map(Object.entries(data.files ?? {})),
    css: data.css ?? null,
    dependencies: data.dependencies ?? {},
  }
}

export async function isLocalRepoAvailable() {
  if (!useLocalRepo()) return false
  try {
    const res = await fetch('/api/local-repo/status', { signal: AbortSignal.timeout(2000) })
    if (!res.ok) return false
    const data = await res.json()
    return Boolean(data.available)
  } catch {
    return false
  }
}
