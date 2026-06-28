import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { RadialGlow } from '../primitives/DepthOfField.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import { slideEnterOpacity, slideExit } from './shared.jsx'

const PUSH_OFFSET = 22
const MAX_PAYOFF_WORDS = 4

function FlowPayoffText({ text, startFrame }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = String(text ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_PAYOFF_WORDS)

  const appearGap = Math.round(fps * 0.1)
  const anchorAppearDur = Math.round(fps * 0.36)
  const anchorPushDur = Math.round(fps * 0.4)
  const wordStagger = Math.round(fps * 0.1)

  const anchorAppearAt = startFrame
  const anchorPushAt = anchorAppearAt + anchorAppearDur + appearGap
  const restStartAt = anchorPushAt + anchorPushDur + appearGap

  const springIn = (at) =>
    spring({
      frame: frame - at,
      fps,
      config: { damping: 28, stiffness: 120 },
    })

  const springPush = (at) =>
    spring({
      frame: frame - at,
      fps,
      config: { damping: 32, stiffness: 100 },
    })

  const anchorAppear = springIn(anchorAppearAt)
  const anchorPush = words.length > 2 ? springPush(anchorPushAt) : 0
  const restCount = Math.max(0, words.length - 2)
  const growthPush = restCount > 0
    ? springPush(restStartAt + restCount * wordStagger)
    : 0

  const blockY =
    interpolate(anchorAppear, [0, 1], [24, 0]) -
    interpolate(anchorPush, [0, 1], [0, PUSH_OFFSET]) -
    interpolate(growthPush, [0, 1], [0, PUSH_OFFSET * 0.45])

  return (
    <span
      style={{
        display: 'inline-block',
        transform: `translateY(${blockY}px)`,
        textAlign: 'center',
        maxWidth: '100%',
      }}
    >
      {words.map((word, i) => {
        const isAnchor = i < 2
        const wordStart = isAnchor
          ? anchorAppearAt + i * Math.round(fps * 0.05)
          : restStartAt + (i - 2) * wordStagger

        const progress = springIn(wordStart)
        const opacity = interpolate(progress, [0, 1], [0, 1])
        const y = interpolate(progress, [0, 1], [18, 0])

        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: 'inline-block',
              opacity,
              transform: `translateY(${y}px)`,
              marginRight: '0.28em',
            }}
          >
            {word}
          </span>
        )
      })}
    </span>
  )
}

export default function LinearPayoffSlide({ slide, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const enter = slideEnterOpacity(frame, fps, false)

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
        alignItems: 'center',
        justifyContent: 'center',
        opacity: enter * exitOpacity,
        transform: exitTransform,
      }}
    >
      <RadialGlow color={theme.backgroundElevated} />
      <h1
        style={{
          margin: 0,
          padding: '0 96px',
          fontSize: 64,
          fontWeight: 600,
          color: theme.text,
          letterSpacing: '-0.035em',
          lineHeight: 1.08,
          textAlign: 'center',
          maxWidth: 960,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <FlowPayoffText text={slide.headline} startFrame={Math.round(fps * 0.2)} />
      </h1>
    </div>
  )
}
