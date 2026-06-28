import {
  AbsoluteFill,
  interpolate,
  Sequence,
  useCurrentFrame,
} from 'remotion'
import { SLIDE_DURATION_FRAMES } from './constants'
import { SlideVisual } from './visuals/SlideVisual'

function CaptionBar({ slide, repo, prNumber }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        padding: '28px 56px 32px',
        background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#afa9ec',
          marginBottom: 10,
        }}
      >
        {slide.tag}
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 700,
          color: '#fff',
          lineHeight: 1.15,
          marginBottom: 8,
        }}
      >
        {slide.headline}
      </div>
      {slide.body && (
        <div style={{ fontSize: 22, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
          {slide.body}
        </div>
      )}
      {repo && (
        <div
          style={{
            marginTop: 14,
            fontSize: 16,
            color: 'rgba(255,255,255,0.35)',
            letterSpacing: '0.04em',
          }}
        >
          {repo} · PR #{prNumber}
        </div>
      )}
    </div>
  )
}

function SlideContent({ slide, repo, prNumber, frame }) {
  const duration = slide.durationFrames ?? SLIDE_DURATION_FRAMES
  const fadeIn = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const fadeOut = interpolate(
    frame,
    [duration - 15, duration],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  )
  const opacity = Math.min(fadeIn, fadeOut)
  const visual = slide.visual ?? { type: 'code-change' }

  if (visual.type === 'hero' || visual.type === 'summary') {
    return (
      <AbsoluteFill
        style={{
          opacity,
          background: 'linear-gradient(160deg, #0b0c10 0%, #12141c 55%, #1a1630 100%)',
          padding: 72,
        }}
      >
        <SlideVisual slide={slide} repo={repo} size="lg" />
      </AbsoluteFill>
    )
  }

  return (
    <AbsoluteFill style={{ opacity, background: '#0b0c10' }}>
      <AbsoluteFill style={{ padding: '40px 48px 200px' }}>
        <SlideVisual slide={slide} repo={repo} size="lg" />
      </AbsoluteFill>
      <CaptionBar slide={slide} repo={repo} prNumber={prNumber} />
    </AbsoluteFill>
  )
}

export function PRVideo({ script }) {
  const slides = script?.slides ?? []
  const repo = script?.pr?.repo
  const prNumber = script?.pr?.number

  let from = 0

  return (
    <AbsoluteFill style={{ background: '#0b0c10' }}>
      {slides.map((slide) => {
        const duration = slide.durationFrames ?? SLIDE_DURATION_FRAMES
        const sequence = (
          <Sequence key={slide.id} from={from} durationInFrames={duration}>
            <SlideWithFrame slide={slide} repo={repo} prNumber={prNumber} />
          </Sequence>
        )
        from += duration
        return sequence
      })}
    </AbsoluteFill>
  )
}

function SlideWithFrame({ slide, repo, prNumber }) {
  const frame = useCurrentFrame()
  return <SlideContent slide={slide} repo={repo} prNumber={prNumber} frame={frame} />
}
