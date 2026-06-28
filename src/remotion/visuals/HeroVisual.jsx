const SIZES = {
  sm: { title: 28, body: 15, label: 14, repo: 14 },
  lg: { title: 56, body: 28, label: 22, repo: 20 },
}

export function HeroVisual({ headline, body, repo, size = 'sm' }) {
  const s = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(145deg, #1a1630 0%, #0b0c10 50%, #12141c 100%)',
        borderRadius: 20,
        border: '1px solid rgba(127, 119, 221, 0.35)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 48,
        textAlign: 'center',
        boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
      }}
    >
      <div
        style={{
          fontSize: s.label,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#afa9ec',
          marginBottom: 20,
        }}
      >
        {repo ?? 'New release'}
      </div>
      <div
        style={{
          fontSize: s.title,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.15,
          marginBottom: 16,
          maxWidth: '90%',
        }}
      >
        {headline}
      </div>
      {body && (
        <div style={{ fontSize: s.body, color: 'rgba(255,255,255,0.65)', maxWidth: '85%', lineHeight: 1.5 }}>
          {body}
        </div>
      )}
    </div>
  )
}
