export function AppScreenVisual({ screen = 'input', headline, body, size = 'sm' }) {
  const scale = size === 'lg' ? 2.2 : 1

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0f12',
        borderRadius: 16,
        border: '1px solid #2e3138',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}>
        {screen === 'input' && (
          <div className="input-card" style={{ margin: 0 }}>
            <h1 className="input-title">{headline || 'Turn your PR into a video'}</h1>
            <p className="input-sub">{body || 'Paste a GitHub repo URL to get started.'}</p>
            <div className="input-row">
              <div className="repo-input" style={{ color: '#555' }}>https://github.com/owner/repo</div>
              <button type="button" className="btn-primary">Generate</button>
            </div>
          </div>
        )}

        {screen === 'review' && (
          <div className="slide-editor" style={{ width: 480 }}>
            <div className="slide-editor-num">1</div>
            <div className="slide-editor-fields">
              <input className="field-input slide-tag-input" readOnly value="Update" />
              <input className="field-input" readOnly value={headline || 'Slide headline'} />
              <textarea className="field-textarea" rows={2} readOnly value={body || 'Slide body copy'} />
            </div>
          </div>
        )}

        {screen === 'video' && (
          <div
            className="video-canvas"
            style={{ width: 480, margin: 0, border: '0.5px solid #2a2d32' }}
          >
            <div className="slide-frame slide-active" style={{ position: 'relative', inset: 'auto', padding: 32 }}>
              <div className="slide-tag-pill">Feature</div>
              <h2 className="slide-headline">{headline || 'Your feature headline'}</h2>
              <p className="slide-body">{body || 'Rendered in Remotion with your app styling.'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
