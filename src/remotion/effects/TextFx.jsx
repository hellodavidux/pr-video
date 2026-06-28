import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*-+=<>'

function WordStagger({ text, startFrame, effect, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { staggerSec = 0.07, fromY = 14 } = effect ?? {}
  const words = text.split(' ')
  return (
    <span style={style}>
      {words.map((word, i) => {
        const wStart = startFrame + i * staggerSec * fps
        const p = interpolate(frame, [wStart, wStart + fps * 0.25], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: p,
              transform: `translateY(${interpolate(p, [0, 1], [fromY, 0])}px)`,
              marginRight: '0.28em',
              whiteSpace: 'pre',
            }}
          >
            {word}
          </span>
        )
      })}
    </span>
  )
}

function CharSpring({ text, startFrame, effect, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { springDamping = 14, springStiffness = 180, staggerMs = 35, fromY = 20 } = effect ?? {}
  const chars = [...text]
  return (
    <span style={{ ...style, display: 'inline-block' }}>
      {chars.map((char, i) => {
        const delay = Math.round((i * staggerMs / 1000) * fps)
        const p = spring({
          frame: frame - startFrame - delay,
          fps,
          config: { damping: springDamping, stiffness: springStiffness },
        })
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: Math.min(1, p * 1.6),
              transform: `translateY(${interpolate(p, [0, 1], [fromY, 0])}px)`,
              whiteSpace: char === ' ' ? 'pre' : 'normal',
            }}
          >
            {char}
          </span>
        )
      })}
    </span>
  )
}

function Scramble({ text, startFrame, effect, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { charDelay = 0.038, scrambleDuration = 0.28 } = effect ?? {}
  const chars = [...text]
  const elapsed = Math.max(0, (frame - startFrame) / fps)

  return (
    <span style={style}>
      {chars.map((char, i) => {
        const start = i * charDelay
        const resolve = start + scrambleDuration
        if (elapsed < start) return <span key={i} style={{ opacity: 0 }}>{char}</span>
        if (elapsed >= resolve) return <span key={i}>{char}</span>
        const scrambled = char === ' '
          ? ' '
          : SCRAMBLE_CHARS[(i * 31 + frame * 7) % SCRAMBLE_CHARS.length]
        return <span key={i}>{scrambled}</span>
      })}
    </span>
  )
}

function GradientSweep({ text, startFrame, effect, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { gradient = 'linear-gradient(90deg, #a855f7, #e879f9, #7c3aed)', duration = 1.2 } = effect ?? {}
  const pos = interpolate(frame - startFrame, [0, duration * fps], [140, -20], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = interpolate(frame - startFrame, [0, fps * 0.18], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  return (
    <span
      style={{
        ...style,
        opacity,
        background: gradient,
        backgroundSize: '200% 100%',
        backgroundPosition: `${pos}% 0`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        display: 'inline-block',
      }}
    >
      {text}
    </span>
  )
}

function Typewriter({ text, startFrame, effect, style }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { charRate = 2.5 } = effect ?? {}
  const elapsed = Math.max(0, frame - startFrame)
  const len = Math.floor((elapsed / fps) * charRate)
  const shown = text.slice(0, len)
  const cursorVisible = Math.floor(elapsed / (fps * 0.5)) % 2 === 0

  return (
    <span style={style}>
      {shown}
      <span style={{ opacity: cursorVisible ? 0.8 : 0, marginLeft: 1 }}>|</span>
    </span>
  )
}

export function TextFx({ text, effect, startFrame = 0, style = {} }) {
  if (!text) return null
  const type = effect?.type ?? 'word-stagger'

  if (type === 'char-spring') {
    return <CharSpring text={text} startFrame={startFrame} effect={effect} style={style} />
  }
  if (type === 'scramble') {
    return <Scramble text={text} startFrame={startFrame} effect={effect} style={style} />
  }
  if (type === 'gradient-sweep') {
    return <GradientSweep text={text} startFrame={startFrame} effect={effect} style={style} />
  }
  if (type === 'typewriter') {
    return <Typewriter text={text} startFrame={startFrame} effect={effect} style={style} />
  }
  return <WordStagger text={text} startFrame={startFrame} effect={effect} style={style} />
}
