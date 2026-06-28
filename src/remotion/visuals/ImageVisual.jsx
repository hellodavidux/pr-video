
const CHROME_HEIGHT = { sm: 36, lg: 52 }

function BrowserChrome({ children, size = 'sm' }) {
  const chromeH = CHROME_HEIGHT[size] ?? CHROME_HEIGHT.sm
  const dotSize = size === 'lg' ? 14 : 10

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
          padding: '0 16px',
          gap: 8,
        }}
      >
        {['#ff5f57', '#febc2e', '#28c840'].map((color) => (
          <div
            key={color}
            style={{ width: dotSize, height: dotSize, borderRadius: '50%', background: color }}
          />
        ))}
        <div
          style={{
            flex: 1,
            marginLeft: 12,
            height: chromeH * 0.55,
            background: '#0d0f12',
            borderRadius: 8,
            border: '1px solid #2a2d32',
          }}
        />
      </div>
      <div style={{ flex: 1, position: 'relative', background: '#0b0c10', minHeight: 0 }}>
        {children}
      </div>
    </div>
  )
}

export function ImageVisual({ imageUrl, alt, size = 'sm' }) {
  if (!imageUrl) {
    return (
      <BrowserChrome size={size}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#666',
            fontSize: size === 'lg' ? 24 : 14,
          }}
        >
          No screenshot attached
        </div>
      </BrowserChrome>
    )
  }

  return (
    <BrowserChrome size={size}>
      <img
        src={imageUrl}
        alt={alt ?? 'Feature screenshot'}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'top center',
        }}
      />
    </BrowserChrome>
  )
}
