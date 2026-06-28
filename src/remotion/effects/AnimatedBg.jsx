import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'

const DEFAULT_BG = 'linear-gradient(160deg, #111114 0%, #18181d 60%, #0e0e12 100%)'

export function AnimatedBg({ background }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  if (!background?.layers?.length) {
    return <div style={{ position: 'absolute', inset: 0, background: DEFAULT_BG }} />
  }

  const baseColor = background.baseColor ?? '#0a0a0f'

  return (
    <div style={{ position: 'absolute', inset: 0, background: baseColor, overflow: 'hidden' }}>
      {background.layers.map((layer, i) => {
        const speed = typeof layer.speed === 'number' ? layer.speed : 0.7
        const phase = typeof layer.phase === 'number' ? layer.phase : 0
        const [minOp, maxOp] = Array.isArray(layer.opacityRange) ? layer.opacityRange : [0.08, 0.28]

        const osc = Math.sin((frame / fps) * Math.PI * speed + phase)
        const opacity = interpolate(osc, [-1, 1], [minOp, maxOp])

        const direction = i % 2 === 0 ? 1 : -1
        const driftX = interpolate(frame, [0, durationInFrames], [0, 0.05 * direction])
        const driftY = interpolate(frame, [0, durationInFrames], [0, -0.04 * direction])

        const cx = Math.max(0, Math.min(100, ((layer.cx ?? 0.5) + driftX) * 100))
        const cy = Math.max(0, Math.min(100, ((layer.cy ?? 0.5) + driftY) * 100))
        const r = Math.max(10, Math.min(120, (layer.r ?? 0.6) * 100))

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(circle at ${cx}% ${cy}%, ${layer.color ?? '#5b21b6'} 0%, transparent ${r}%)`,
              opacity,
            }}
          />
        )
      })}

      {background.noise && (
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            opacity: background.noise.opacity ?? 0.04,
            pointerEvents: 'none',
          }}
        >
          <filter id="animatedbg-noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency={background.noise.scale ?? 0.016}
              numOctaves={4}
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#animatedbg-noise)" />
        </svg>
      )}
    </div>
  )
}
