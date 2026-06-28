import { useState } from 'react'
import { SlideVisual } from '../remotion/visuals/SlideVisual'
import { VISUAL_TYPES } from '../remotion/visuals/visualTypes'
import { isUIFile } from '../lib/prFiles'

export default function ScriptReview({ prData, onApproved }) {
  const { pr, script: initial } = prData
  const [script, setScript] = useState(initial)
  const [showCaptureError, setShowCaptureError] = useState(false)
  const componentSources = script.componentSources ?? []
  const styleSources = script.styleSources ?? []
  const uiFiles = (script.changedFiles ?? pr.files ?? []).filter(isUIFile)

  function updateSlide(id, field, value) {
    setScript((s) => ({
      ...s,
      slides: s.slides.map((slide) =>
        slide.id === id ? { ...slide, [field]: value } : slide
      ),
    }))
  }

  function updateSlideVisual(id, visual) {
    setScript((s) => ({
      ...s,
      slides: s.slides.map((slide) =>
        slide.id === id ? { ...slide, visual } : slide
      ),
    }))
  }

  function updateField(field, value) {
    setScript((s) => ({ ...s, [field]: value }))
  }

  function setVisualType(slide, type) {
    if (type === 'hero' || type === 'summary') {
      updateSlideVisual(slide.id, { type })
      return
    }
    if (type === 'app-screenshot') {
      updateSlideVisual(slide.id, {
        type: 'app-screenshot',
        imageUrl: slide.visual?.imageUrl ?? null,
        filePath: slide.visual?.filePath ?? null,
        alt: slide.visual?.alt ?? slide.headline,
      })
      return
    }
    if (type === 'component-preview') {
      updateSlideVisual(slide.id, {
        type: 'component-preview',
        filename: slide.visual?.filename ?? slide.headline,
        previewCode: slide.visual?.previewCode ?? null,
        canPreview: slide.visual?.canPreview ?? false,
        injectedCss: slide.visual?.injectedCss ?? '',
        highlightLines: slide.visual?.highlightLines ?? [],
        status: slide.visual?.status ?? 'modified',
        patch: slide.visual?.patch ?? null,
      })
      return
    }
    updateSlideVisual(slide.id, {
      type: 'code-change',
      filename: slide.visual?.filename ?? slide.headline,
      patch: slide.visual?.patch ?? null,
      status: slide.visual?.status ?? 'modified',
      highlightLines: slide.visual?.highlightLines ?? [],
    })
  }

  return (
    <div className="view-review">
      <div className="review-header">
        <div>
          <h2 className="review-title">Review your script</h2>
          <a href={pr.url} target="_blank" rel="noreferrer" className="pr-link">
            PR #{pr.number}: {pr.title}
          </a>
          <p className="meta-hint" style={{ marginTop: 8 }}>
            ~{script.estimatedDurationSec ?? '?'}s video · {script.slides.length} slides
            {script.hasScreenshots && ' · app UI captured'}
            {script.captureMode && ` (${script.captureMode})`}
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => onApproved({ ...script, pr, approved_at: new Date().toISOString() })}
        >
          Approve and generate video →
        </button>
      </div>

      {script.captureError && (
        <div className="low-confidence-banner">
          Could not capture app UI — showing component previews / diffs instead.{' '}
          <button
            type="button"
            className="pr-link"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            onClick={() => setShowCaptureError((v) => !v)}
          >
            {showCaptureError ? 'Hide details' : 'Show details'}
          </button>
          {showCaptureError && (
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>{script.captureError}</div>
          )}
        </div>
      )}

      {script.confidence < 0.4 && (
        <div className="low-confidence-banner">
          Low confidence ({Math.round(script.confidence * 100)}%) — {script.skip_reason}. You can still proceed.
        </div>
      )}

      <div className="pr-meta-panel">
        {componentSources.length > 0 && (
          <div className="pr-meta-row">
            <span className="field-label">
              React components ({componentSources.length})
            </span>
            <div className="changed-files-list">
              {componentSources.map((c) => (
                <span key={c.filename} className="changed-file-pill">
                  {c.filename}
                  {!c.source && ' (diff only)'}
                </span>
              ))}
            </div>
          </div>
        )}
        {styleSources.length > 0 && (
          <div className="pr-meta-row">
            <span className="field-label">Style files ({styleSources.length})</span>
            <div className="changed-files-list">
              {styleSources.map((f) => (
                <span key={f.filename} className="changed-file-pill">{f.filename}</span>
              ))}
            </div>
          </div>
        )}
        {uiFiles.length > 0 && (
          <div className="pr-meta-row">
            <span className="field-label">All changed UI files ({uiFiles.length})</span>
            <div className="changed-files-list">
              {uiFiles.slice(0, 10).map((f) => (
                <span key={f.filename} className="changed-file-pill">{f.filename}</span>
              ))}
            </div>
          </div>
        )}
        <p className="meta-hint">
          App screenshots are captured from deploy previews or a local build. Component slides use react-live as fallback.
        </p>
      </div>

      <div className="review-grid">
        <div className="review-left">
          <label className="field-label">Opening hook</label>
          <textarea
            className="field-textarea"
            rows={2}
            value={script.hook}
            onChange={(e) => updateField('hook', e.target.value)}
          />

          <label className="field-label" style={{ marginTop: 16 }}>Caption</label>
          <textarea
            className="field-textarea"
            rows={3}
            value={script.caption}
            onChange={(e) => updateField('caption', e.target.value)}
          />

          <label className="field-label" style={{ marginTop: 16 }}>Hashtags</label>
          <input
            className="field-input"
            value={script.hashtags.join(', ')}
            onChange={(e) =>
              updateField(
                'hashtags',
                e.target.value.split(',').map((h) => h.trim().replace(/^#/, ''))
              )
            }
          />

          <div className="tone-row">
            <span className="field-label">Tone</span>
            <span className={`tone-pill tone-${script.tone}`}>{script.tone}</span>
          </div>
        </div>

        <div className="review-right">
          <label className="field-label">Slides ({script.slides.length})</label>
          {script.slides.map((slide, i) => (
            <div key={slide.id} className="slide-editor">
              <div className="slide-editor-num">{i + 1}</div>
              <div className="slide-editor-fields">
                <div className="slide-visual-preview">
                  <div className="slide-visual-preview-inner">
                    <SlideVisual slide={slide} repo={pr.repo} />
                  </div>
                </div>

                <div className="visual-controls">
                  <label className="field-label">Visual</label>
                  <select
                    className="field-input"
                    value={slide.visual?.type ?? 'component-preview'}
                    onChange={(e) => setVisualType(slide, e.target.value)}
                  >
                    {VISUAL_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <input
                  className="field-input slide-tag-input"
                  placeholder="Tag"
                  value={slide.tag}
                  onChange={(e) => updateSlide(slide.id, 'tag', e.target.value)}
                />
                <input
                  className="field-input"
                  placeholder="Headline"
                  value={slide.headline}
                  onChange={(e) => updateSlide(slide.id, 'headline', e.target.value)}
                />
                <textarea
                  className="field-textarea"
                  rows={2}
                  placeholder="Body"
                  value={slide.body}
                  onChange={(e) => updateSlide(slide.id, 'body', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

