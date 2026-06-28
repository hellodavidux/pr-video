export function DepthOfField({ children, intensity = 1 }) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {children}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: `linear-gradient(180deg,
            rgba(0,0,0,${0.45 * intensity}) 0%,
            transparent 18%,
            transparent 72%,
            rgba(0,0,0,${0.55 * intensity}) 100%)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          boxShadow: `inset 0 0 ${120 * intensity}px rgba(0,0,0,${0.35 * intensity})`,
        }}
      />
    </div>
  )
}

export function RadialGlow({ color = '#1a1a1a', style = {} }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse 50% 45% at 50% 45%, ${color} 0%, transparent 70%)`,
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
