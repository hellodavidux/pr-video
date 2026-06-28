import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CodePillRow } from '../primitives/CodePill.jsx'
import { DepthOfField, RadialGlow } from '../primitives/DepthOfField.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import FloatingDemoSurface from './FloatingDemoSurface.jsx'
import { slideEnterOpacity, slideExit } from './shared.jsx'

export default function LinearResponseBeat({ slide, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const chained = Boolean(slide.continuesFrom)
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const enter = slideEnterOpacity(frame, fps, chained)
  const productLabel = theme.productName ?? 'Product'

  const textReveal = interpolate(frame, [fps * 0.2, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const userQuery = slide.userQuery ?? slide.narration ?? 'What does this change?'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: theme.fontDisplay,
        opacity: enter * exitOpacity,
        transform: exitTransform,
      }}
    >
      <DepthOfField intensity={1}>
        <RadialGlow color={theme.backgroundElevated} style={{ opacity: 0.7 }} />

        <div style={{ position: 'absolute', inset: 0, padding: '48px 72px', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20, letterSpacing: '-0.01em' }}>
            Ask {productLabel}
          </div>

          <div
            style={{
              alignSelf: 'flex-start',
              maxWidth: 480,
              padding: '12px 16px',
              borderRadius: 10,
              background: theme.surface,
              border: `1px solid ${theme.surfaceBorder}`,
              color: theme.textSecondary,
              fontSize: 15,
              marginBottom: 28,
              opacity: textReveal,
              transform: `translateY(${interpolate(textReveal, [0, 1], [8, 0])}px)`,
            }}
          >
            {userQuery}
          </div>

          <div
            style={{
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 40,
              alignItems: 'center',
              minHeight: 0,
            }}
          >
            <div style={{ opacity: textReveal }}>
              <p
                style={{
                  margin: 0,
                  fontSize: 28,
                  fontWeight: 500,
                  color: theme.text,
                  lineHeight: 1.35,
                  letterSpacing: '-0.02em',
                  maxWidth: 440,
                }}
              >
                {slide.headline}
              </p>
              <CodePillRow paths={slide.codePaths} />
            </div>

            <FloatingDemoSurface
              slide={slide}
              frame={frame}
              fps={fps}
              durationInFrames={durationInFrames}
              chained={chained}
              maxWidth={520}
            />
          </div>
        </div>
      </DepthOfField>
    </div>
  )
}
