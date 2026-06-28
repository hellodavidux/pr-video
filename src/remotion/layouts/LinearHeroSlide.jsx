import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { AsteriskGrid } from '../primitives/AsteriskGrid.jsx'
import { BlurredComponentBackdrop } from '../primitives/BlurredComponentBackdrop.jsx'
import { DepthOfField, RadialGlow } from '../primitives/DepthOfField.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import { slideExit } from './shared.jsx'

const PLANE_TRANSFORM = 'perspective(1400px) rotateX(18deg) rotateY(-10deg)'

function WordReveal({ text, startFrame }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = String(text ?? '').split(/\s+/).filter(Boolean)
  const wordGap = Math.round(fps * 0.14)
  const revealDur = Math.round(fps * 0.22)

  return (
    <span>
      {words.map((word, i) => {
        const wordStart = startFrame + i * wordGap
        const progress = interpolate(frame, [wordStart, wordStart + revealDur], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        })
        const opacity = progress
        const y = interpolate(progress, [0, 1], [6, 0])

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              marginRight: '0.28em',
              opacity,
              transform: `translateY(${y}px)`,
            }}
          >
            {word}
          </span>
        )
      })}
    </span>
  )
}

export default function LinearHeroSlide({ slide, pr, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const headlineStart = Math.round(fps * 0.55)

  const fadeIn = interpolate(frame, [0, fps * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const zoomOut = interpolate(frame, [0, fps * 2.5], [1.07, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: theme.background,
        position: 'relative',
        overflow: 'hidden',
        fontFamily: theme.fontDisplay,
        opacity: exitOpacity,
        transform: exitTransform,
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          opacity: fadeIn,
          transform: `scale(${zoomOut})`,
          transformOrigin: '50% 50%',
        }}
      >
        <BlurredComponentBackdrop preview={slide.preview} heroReveal />

        <DepthOfField intensity={1.1}>
          <RadialGlow color={theme.backgroundElevated} style={{ opacity: 0.85 }} />

          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 2,
              padding: '0 80px',
            }}
          >
            <div
              style={{
                position: 'relative',
                transform: PLANE_TRANSFORM,
                transformOrigin: '50% 50%',
                textAlign: 'center',
                maxWidth: 860,
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  bottom: '100%',
                  transform: 'translateX(-50%)',
                  pointerEvents: 'none',
                }}
              >
                <AsteriskGrid highlight dimmed embedded perspective={false} />
              </div>

              <h1
                style={{
                  margin: 0,
                  fontSize: 56,
                  fontWeight: 500,
                  color: theme.text,
                  letterSpacing: '-0.035em',
                  lineHeight: 1.1,
                  textShadow: '0 2px 40px rgba(0,0,0,0.5), 0 0 80px rgba(255,255,255,0.06)',
                }}
              >
                <WordReveal text={slide.headline} startFrame={headlineStart} />
              </h1>
            </div>
          </div>
        </DepthOfField>
      </div>
    </div>
  )
}
