export async function checkLocalServer() {
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) })
    return res.ok
  } catch {
    return false
  }
}

export async function captureFromLocalRepo(pr, { mode = 'auto' } = {}) {
  const res = await fetch('/api/host-and-capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      owner: pr.owner,
      repoName: pr.repoName,
      headRef: pr.headRef,
      prNumber: pr.number,
      mode,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = err.message || `Build and capture failed (${res.status})`
    throw new Error(message.length > 600 ? `${message.slice(0, 600)}…` : message)
  }

  return res.json()
}

export async function exportVideo(script) {
  const res = await fetch('/api/render', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ script }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = err.message || `Remotion render failed (${res.status})`
    throw new Error(message.length > 600 ? `${message.slice(0, 600)}…` : message)
  }

  return res.json()
}

export async function stopLocalSession(jobId) {
  if (!jobId) return
  try {
    await fetch(`/api/stop/${jobId}`, { method: 'POST' })
  } catch {
    // server may already be down
  }
}
