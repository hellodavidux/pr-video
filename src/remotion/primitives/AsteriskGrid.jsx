import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { Easing } from 'remotion'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'

export function AsteriskGrid({ highlight = true, perspective = true, dimmed = false, embedded = false }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()

  const cols = 28
  const rows = 14
  const cells = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ r, c })
    }
  }

  const highlightCol = 13
  const highlightRow = 6
  const cursorBlink = Math.floor(frame / (fps * 0.5)) % 2 === 0

  const gridOpacity = dimmed ? [0.28, 0.1, 0.035] : [0.85, 0.25, 0.08]
  const highlightOpacity = dimmed ? 0.55 : 1

  const grid = (
    <div
      style={{
        position: 'relative',
        transform: perspective && !embedded
          ? 'perspective(1400px) rotateX(18deg) rotateY(-10deg) scale(1.05)'
          : undefined,
        transformOrigin: '50% 40%',
        maskImage: embedded
          ? 'radial-gradient(ellipse 70% 60% at 50% 50%, black 10%, transparent 78%)'
          : 'radial-gradient(ellipse 55% 50% at 50% 42%, black 20%, transparent 72%)',
        WebkitMaskImage: embedded
          ? 'radial-gradient(ellipse 70% 60% at 50% 50%, black 10%, transparent 78%)'
          : 'radial-gradient(ellipse 55% 50% at 50% 42%, black 20%, transparent 72%)',
        opacity: dimmed ? 0.65 : 1,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '10px 14px',
          fontFamily: theme.fontMono,
          fontSize: 13,
          lineHeight: 1,
          userSelect: 'none',
        }}
      >
        {cells.map(({ r, c }) => {
          const isHi = highlight && r === highlightRow && c === highlightCol
          const dist = Math.hypot(c - highlightCol, r - highlightRow)
          const opacity = interpolate(dist, [0, 8, 16], gridOpacity, { extrapolateRight: 'clamp' })

          return (
            <span
              key={`${r}-${c}`}
              style={{
                color: isHi ? theme.text : theme.textMuted,
                opacity: isHi ? highlightOpacity : opacity,
                fontWeight: isHi ? 600 : 400,
                textShadow: isHi && !dimmed ? `0 0 20px ${theme.accent}88` : undefined,
              }}
            >
              *
            </span>
          )
        })}
      </div>

      {highlight && (
        <div
          style={{
            position: 'absolute',
            left: `calc(${(highlightCol + 1.15) / cols} * 100%)`,
            top: `calc(${(highlightRow + 0.1) / rows} * 100%)`,
            fontFamily: theme.fontMono,
            fontSize: 13,
            color: theme.text,
            opacity: cursorBlink ? highlightOpacity * 0.8 : 0,
            fontWeight: 600,
          }}
        >
          _
        </div>
      )}
    </div>
  )

  if (embedded) {
    return (
      <div style={{ marginBottom: 36, pointerEvents: 'none' }}>
        {grid}
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        pointerEvents: 'none',
      }}
    >
      {grid}
    </div>
  )
}
