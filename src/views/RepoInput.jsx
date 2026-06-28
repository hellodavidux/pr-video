import { useEffect, useState } from 'react'
import { fetchLatestOpenPR } from '../lib/fetchPR'
import { fetchUISources } from '../lib/fetchComponentSources'
import { buildScriptFromPR } from '../lib/buildScriptFromPR'
import { captureUIScreenshots } from '../lib/captureUIScreenshots'

function formatElapsed(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export default function RepoInput({ onFetched }) {
  const [repoUrl, setRepoUrl] = useState('')
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)
  const [elapsed, setElapsed] = useState(0)

  const loading = ['fetching', 'loading-ui', 'capturing', 'building'].includes(status)

  useEffect(() => {
    if (!loading) {
      setElapsed(0)
      return undefined
    }
    const timer = setInterval(() => setElapsed((n) => n + 1), 1000)
    return () => clearInterval(timer)
  }, [loading])

  async function handleSubmit() {
    if (!repoUrl.trim()) {
      setError('GitHub repo URL is required')
      return
    }

    setError(null)

    try {
      setStatus('fetching')
      const pr = await fetchLatestOpenPR(repoUrl.trim())

      setStatus('loading-ui')
      const { componentSources, styleSources } = await fetchUISources(pr)

      setStatus('capturing')
      const capture = await captureUIScreenshots(pr)

      setStatus('building')
      const script = buildScriptFromPR(pr, {
        componentSources,
        styleSources,
        screenshots: capture.screenshots,
        appUrl: capture.appUrl,
        captureMode: capture.captureMode,
        captureJobId: capture.jobId,
        captureError: capture.error,
      })

      onFetched({ pr, script })
    } catch (err) {
      setError(err.message)
      setStatus('error')
    }
  }

  return (
    <div className="view-center">
      <div className="input-card input-card-wide">
        <h1 className="input-title">Turn your PR into a promo video</h1>
        <p className="input-sub">
          Captures <strong>live app UI</strong> from deploy previews or a local build, then builds slides from changed components and CSS.
        </p>

        <label className="field-label">GitHub repo</label>
        <input
          className="repo-input repo-input-full"
          type="url"
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
          disabled={loading}
        />

        <button
          className="btn-primary input-submit-btn"
          onClick={handleSubmit}
          disabled={loading || !repoUrl.trim()}
        >
          {loading ? '...' : 'Generate'}
        </button>

        {status === 'fetching' && (
          <p className="status-msg">Fetching latest open PR…</p>
        )}
        {status === 'loading-ui' && (
          <p className="status-msg">Loading React and CSS from the PR…</p>
        )}
        {status === 'capturing' && (
          <p className="status-msg">
            Capturing app UI (preview or local build — may take a few minutes)…{' '}
            {elapsed > 0 && `(${formatElapsed(elapsed)})`}
          </p>
        )}
        {status === 'building' && <p className="status-msg">Building slides…</p>}
        {error && <p className="error-msg">{error}</p>}

        <p className="meta-hint" style={{ marginTop: 16 }}>
          Works with <code className="inline-code">.tsx</code>, <code className="inline-code">.jsx</code>, and{' '}
          <code className="inline-code">.css</code> changes. Vercel/Netlify preview URLs are used when available.
        </p>
      </div>
    </div>
  )
}
