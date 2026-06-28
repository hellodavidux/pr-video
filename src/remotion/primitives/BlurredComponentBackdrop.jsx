import { Easing, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { heroRevealTiming, resolvePreviewSlideId } from '../../lib/slideUtils.js'
import GeneratedPreview from '../GeneratedPreview.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'

const PERSPECTIVE = 'perspective(1100px) rotateX(28deg) rotateY(-14deg) scale(1.15)'
const PREVIEW_W = 960
const PREVIEW_H = 540

export function BlurredComponentBackdrop({
  preview,
  highlight = { x: 42, y: 38, w: 28, h: 22 },
  opacity = 0.72,
  heroReveal = false,
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()

  if (!resolvePreviewSlideId(preview)) return null

  const revealProgress = interpolate(frame, [0, fps * 1.4], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  })

  const drift = interpolate(frame, [0, fps * 3], [0, 1], { extrapolateRight: 'clamp' })
  const translateY = interpolate(drift, [0, 1], [heroReveal ? 32 : 24, 0])
  const scale = heroReveal
    ? interpolate(revealProgress, [0, 1], [0.94, 1])
    : 1
  const blur = heroReveal
    ? interpolate(revealProgress, [0, 1], [10, 2.5])
    : 7
  const brightness = heroReveal
    ? interpolate(revealProgress, [0, 1], [0.72, 0.92])
    : 0.85
  const panelOpacity = heroReveal
    ? interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' }) * opacity
    : opacity

  const revealTiming = heroReveal ? heroRevealTiming(fps) : null

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: panelOpacity,
      }}
    >
      <div
        style={{
          position: 'relative',
          width: PREVIEW_W,
          height: PREVIEW_H,
          transform: `${PERSPECTIVE} translateY(${translateY}px) scale(${scale})`,
          transformOrigin: '50% 55%',
          filter: `blur(${blur}px) brightness(${brightness})`,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            borderRadius: theme.radius ?? 12,
            background: theme.surface,
            border: `1px solid ${theme.surfaceBorder}`,
          }}
        >
          <GeneratedPreview
            preview={preview}
            heroReveal={heroReveal ? { enabled: true, ...revealTiming } : undefined}
          />
        </div>

        {/* Soft highlighter over the focal UI region */}
        <div
          style={{
            position: 'absolute',
            left: `${highlight.x}%`,
            top: `${highlight.y}%`,
            width: `${highlight.w}%`,
            height: `${highlight.h}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: '50%',
            background: `radial-gradient(ellipse at center,
              rgba(255,255,255,0.32) 0%,
              rgba(255,255,255,0.12) 35%,
              transparent 68%)`,
            boxShadow: '0 0 100px 50px rgba(255,255,255,0.08)',
            mixBlendMode: 'screen',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${highlight.x}%`,
            top: `${highlight.y}%`,
            width: `${highlight.w * 0.55}%`,
            height: `${highlight.h * 0.55}%`,
            transform: 'translate(-50%, -50%)',
            borderRadius: 8,
            border: '1px solid rgba(255,255,255,0.18)',
            boxShadow: 'inset 0 0 24px rgba(255,255,255,0.12), 0 0 40px rgba(255,255,255,0.15)',
          }}
        />
      </div>
    </div>
  )
}
