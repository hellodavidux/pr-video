import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { TriangleLogo } from '../primitives/TriangleLogo.jsx'
import { RadialGlow } from '../primitives/DepthOfField.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import { slideEnterOpacity, slideExit } from './shared.jsx'

export default function LinearOutroSlide({ slide, pr, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const enter = slideEnterOpacity(frame, fps, false)

  const logoSpring = spring({
    frame: frame - fps * 0.2,
    fps,
    config: { damping: 22, stiffness: 80 },
  })

  const scale = interpolate(logoSpring, [0, 1], [0.45, 1])
  const logoOpacity = interpolate(logoSpring, [0, 1], [0, 1])

  const labelOpacity = interpolate(frame, [fps * 0.8, fps * 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const productName = theme.productName ?? pr?.repo?.replace(/^.*\//, '') ?? 'Product'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: theme.fontDisplay,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        opacity: enter * exitOpacity,
        transform: exitTransform,
      }}
    >
      <RadialGlow color={theme.backgroundElevated} style={{ opacity: 0.6 }} />

      <div style={{ transform: `scale(${scale})`, opacity: logoOpacity, position: 'relative', zIndex: 1 }}>
        <TriangleLogo size={72} color={theme.accent} strokeWidth={1.8} />
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 500,
          color: theme.textMuted,
          letterSpacing: '-0.02em',
          opacity: labelOpacity,
          position: 'relative',
          zIndex: 1,
        }}
      >
        {productName} · Available now
      </p>
    </div>
  )
}
