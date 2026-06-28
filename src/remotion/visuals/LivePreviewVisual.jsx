function BrowserChrome({ url, size, children }) {
  const chromeH = size === 'lg' ? 52 : 36
  const fontSize = size === 'lg' ? 16 : 11

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#1a1d24',
        borderRadius: size === 'lg' ? 20 : 16,
        border: '1px solid #2e3138',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          height: chromeH,
          flexShrink: 0,
          background: '#111318',
          borderBottom: '1px solid #2e3138',
          display: 'flex',
          alignItems: 'center',
          padding: '0 14px',
          gap: 8,
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
          <div
            key={color}
            style={{
              width: size === 'lg' ? 14 : 10,
              height: size === 'lg' ? 14 : 10,
              borderRadius: '50%',
              background: color,
            }}
          />
        ))}
        <div
          style={{
            flex: 1,
            marginLeft: 8,
            height: chromeH * 0.55,
            background: '#0d0f12',
            borderRadius: 8,
            border: '1px solid #2a2d32',
            display: 'flex',
            alignItems: 'center',
            padding: '0 12px',
            fontSize,
            color: '#7f99dd',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
          }}
        >
          {url}
        </div>
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#0b0c10', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

export function LivePreviewVisual({ url, size = 'sm' }) {
  if (!url) {
    return (
      <BrowserChrome url="No preview URL" size={size}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: size === 'lg' ? 22 : 14,
            padding: 24,
            textAlign: 'center',
          }}
        >
          Add a Vercel/Netlify preview link to the PR
        </div>
      </BrowserChrome>
    )
  }

  return (
    <BrowserChrome url={url} size={size}>
      <iframe
        title="App preview"
        src={url}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          border: 0,
          background: '#fff',
        }}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
      />
    </BrowserChrome>
  )
}
