const SIZES = {
  sm: { title: 18, body: 13, icon: 36, bar: 10 },
  lg: { title: 36, body: 24, icon: 64, bar: 16 },
}

function CardMock({ headline, body, size }) {
  const s = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(160deg, #151820 0%, #0d0f12 100%)',
        borderRadius: 16,
        border: '1px solid #2e3138',
        padding: size === 'lg' ? 48 : 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          width: '88%',
          background: '#1a1d24',
          borderRadius: 14,
          border: '1px solid rgba(127, 119, 221, 0.35)',
          padding: size === 'lg' ? '36px 40px' : '22px 24px',
          boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div
          style={{
            width: s.icon,
            height: s.icon,
            borderRadius: 12,
            background: 'linear-gradient(135deg, #534ab7, #7f77dd)',
            marginBottom: size === 'lg' ? 24 : 14,
          }}
        />
        <div style={{ fontSize: s.title, fontWeight: 600, color: '#fff', marginBottom: 10 }}>
          {headline}
        </div>
        <div style={{ fontSize: s.body, lineHeight: 1.5, color: 'rgba(255,255,255,0.62)' }}>
          {body}
        </div>
      </div>
    </div>
  )
}

function DashboardMock({ headline, body, size }) {
  const s = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0f12',
        borderRadius: 16,
        border: '1px solid #2e3138',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: '28%',
          background: '#111318',
          borderRight: '1px solid #2e3138',
          padding: size === 'lg' ? 28 : 16,
          display: 'flex',
          flexDirection: 'column',
          gap: size === 'lg' ? 16 : 10,
        }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            style={{
              height: s.bar,
              borderRadius: s.bar / 2,
              background: i === 1 ? '#534ab7' : '#1e2128',
              width: i === 1 ? '80%' : `${55 + i * 6}%`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          flex: 1,
          padding: size === 'lg' ? 32 : 18,
          display: 'flex',
          flexDirection: 'column',
          gap: size === 'lg' ? 20 : 12,
        }}
      >
        <div style={{ fontSize: s.title, fontWeight: 600, color: '#fff' }}>{headline}</div>
        <div
          style={{
            flex: 1,
            background: '#151820',
            borderRadius: 12,
            border: '1px solid #252830',
            padding: size === 'lg' ? 28 : 14,
            fontSize: s.body,
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.55)',
          }}
        >
          {body}
        </div>
        <div style={{ display: 'flex', gap: size === 'lg' ? 16 : 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: size === 'lg' ? 80 : 48,
                borderRadius: 10,
                background: i === 1 ? 'rgba(127,119,221,0.2)' : '#1a1d24',
                border: '1px solid #2a2d32',
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function NotificationMock({ headline, body, size }) {
  const s = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(160deg, #12141c 0%, #0b0c10 100%)',
        borderRadius: 16,
        border: '1px solid #2e3138',
        padding: size === 'lg' ? 36 : 20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: size === 'lg' ? 20 : 10,
      }}
    >
      <div
        style={{
          alignSelf: 'flex-end',
          width: '92%',
          background: '#1a1d24',
          borderRadius: 14,
          border: '1px solid rgba(127, 119, 221, 0.4)',
          padding: size === 'lg' ? '24px 28px' : '14px 16px',
          boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ fontSize: s.title, fontWeight: 600, color: '#fff', marginBottom: 8 }}>
          {headline}
        </div>
        <div style={{ fontSize: s.body, color: 'rgba(255,255,255,0.6)', lineHeight: 1.45 }}>
          {body}
        </div>
      </div>
      <div
        style={{
          width: '78%',
          height: size === 'lg' ? 56 : 36,
          borderRadius: 10,
          background: '#151820',
          border: '1px solid #252830',
        }}
      />
    </div>
  )
}

const VARIANTS = {
  card: CardMock,
  dashboard: DashboardMock,
  notification: NotificationMock,
}

export function MockUIVisual({ variant = 'card', headline, body, size = 'sm' }) {
  const Component = VARIANTS[variant] ?? CardMock
  return <Component headline={headline} body={body} size={size} />
}

export const MOCK_UI_VARIANTS = Object.keys(VARIANTS)
