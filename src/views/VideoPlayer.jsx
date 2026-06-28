import { useEffect, useMemo, useState } from 'react'
import { Player } from '@remotion/player'
import { LinearPRVideo, getLinearVideoDurationInFrames } from '../remotion/LinearPRVideo.jsx'
import {
  COMPOSITION_HEIGHT,
  COMPOSITION_WIDTH,
  PR_VIDEO_FPS,
} from '../remotion/constants'
import { exportVideo, checkLocalServer, stopLocalSession } from '../lib/captureLocalApp'
import { buildLocalDemoScript } from '../lib/localDemoScript.js'

export default function VideoPlayer({ script: approvedScript }) {
  const videoScript = useMemo(
    () => buildLocalDemoScript(undefined, approvedScript),
    [approvedScript],
  )

  const durationInFrames = getLinearVideoDurationInFrames(videoScript.slides)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState(null)
  const [exportError, setExportError] = useState(null)

  useEffect(() => {
    return () => stopLocalSession(approvedScript.captureJobId)
  }, [approvedScript.captureJobId])

  async function handleExport() {
    setExportError(null)
    setExporting(true)

    try {
      const apiUp = await checkLocalServer()
      if (!apiUp) {
        throw new Error('Run npm run dev so Remotion can export the MP4.')
      }

      const result = await exportVideo(videoScript)
      setExportUrl(result.videoUrl)
    } catch (err) {
      setExportError(err.message)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="view-video">
      <div className="video-canvas remotion-player-wrap">
        <Player
          component={LinearPRVideo}
          inputProps={{ script: videoScript }}
          durationInFrames={durationInFrames}
          compositionWidth={COMPOSITION_WIDTH}
          compositionHeight={COMPOSITION_HEIGHT}
          fps={PR_VIDEO_FPS}
          style={{ width: '100%', height: '100%' }}
          controls
          clickToPlay
          acknowledgeRemotionLicense
        />
      </div>

      <div className="export-panel">
        <p className="meta-hint" style={{ marginBottom: 12 }}>
          ~{videoScript.estimatedDurationSec ?? Math.round(durationInFrames / PR_VIDEO_FPS)}s ·{' '}
          {videoScript.slides.length} slides · live cal-simple UI
        </p>

        <button className="btn-primary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Rendering MP4…' : 'Export MP4 with Remotion'}
        </button>

        {exportUrl && (
          <p className="status-msg">
            <a href={exportUrl} download="pr-promo.mp4" className="pr-link">
              Download video.mp4
            </a>
          </p>
        )}

        {exportError && <p className="error-msg">{exportError}</p>}

        {!exportUrl && !exporting && (
          <p className="render-hint">
            Demo video uses real Ask Cal components from your local cal-simple repo.
          </p>
        )}
      </div>

      {(videoScript.caption || approvedScript.caption) && (
        <div className="caption-box">
          <p className="caption-text">{videoScript.caption || approvedScript.caption}</p>
          <div className="hashtag-row">
            {(videoScript.hashtags ?? approvedScript.hashtags ?? []).map((h) => (
              <span key={h} className="hashtag">#{h}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
