import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

export function HeaderBadge({ text, accentColor = '#a5b4fc', startFrame = 0 }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  if (!text) return null

  const p = spring({
    frame: frame - startFrame - 3,
    fps,
    config: { damping: 13, stiffness: 220 },
  })
  const fromY = interpolate(p, [0, 1], [-28, 0])
  const opacity = Math.min(1, p * 2)

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 14px',
        background: `${accentColor}1a`,
        border: `1px solid ${accentColor}40`,
        borderRadius: '99px',
        color: accentColor,
        fontSize: 11,
        fontFamily: "'SF Mono', 'Fira Mono', monospace",
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: 20,
        transform: `translateY(${fromY}px)`,
        opacity,
      }}
    >
      {text}
    </div>
  )
}
