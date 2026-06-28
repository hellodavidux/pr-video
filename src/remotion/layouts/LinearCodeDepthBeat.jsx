import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { CodePill } from '../primitives/CodePill.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import FloatingDemoSurface from './FloatingDemoSurface.jsx'
import { slideEnterOpacity, slideExit } from './shared.jsx'

function CodeSnippetBg({ snippets = [] }) {
  const theme = useProductTheme()
  const items = snippets.length > 0 ? snippets : [
    'const now = new Date();',
    'if (isExpired) {',
    '  throw new ExpiredInviteLinkError();',
    '}',
    'return { status: "valid" };',
  ]

  const positions = [
    { top: '8%', left: '6%', blur: 2, opacity: 0.35 },
    { top: '12%', right: '8%', blur: 3, opacity: 0.28 },
    { bottom: '18%', left: '10%', blur: 2.5, opacity: 0.32 },
    { bottom: '14%', right: '12%', blur: 1.5, opacity: 0.4 },
  ]

  return (
    <>
      {items.slice(0, 4).map((line, i) => {
        const pos = positions[i] ?? positions[0]
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...pos,
              fontFamily: theme.fontMono,
              fontSize: 12,
              color: theme.textSecondary,
              filter: `blur(${pos.blur}px)`,
              opacity: pos.opacity,
              maxWidth: 320,
              whiteSpace: 'pre-wrap',
              pointerEvents: 'none',
            }}
          >
            {line}
          </div>
        )
      })}
    </>
  )
}

export default function LinearCodeDepthBeat({ slide, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const chained = Boolean(slide.continuesFrom)
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const enter = slideEnterOpacity(frame, fps, chained)

  const contentIn = interpolate(frame, [fps * 0.15, fps * 0.7], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const codePaths = slide.codePaths ?? []

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#000',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: theme.fontMono,
        opacity: enter * exitOpacity,
        transform: exitTransform,
      }}
    >
      <CodeSnippetBg snippets={slide.codeSnippets} />

      {codePaths.slice(0, 2).map((path, i) => (
        <div
          key={path}
          style={{
            position: 'absolute',
            top: i === 0 ? '10%' : undefined,
            bottom: i === 1 ? '16%' : undefined,
            left: i === 0 ? '8%' : undefined,
            right: i === 1 ? '10%' : undefined,
            filter: 'blur(1px)',
            opacity: 0.5,
          }}
        >
          <CodePill label={path} />
        </div>
      ))}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <div style={{ width: '100%', maxWidth: 640, opacity: contentIn * 0.95 }}>
            <FloatingDemoSurface
              slide={slide}
              frame={frame}
              fps={fps}
              durationInFrames={durationInFrames}
              chained={chained}
              maxWidth={640}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
