import { interpolate } from 'remotion'

export function slideEnterOpacity(frame, fps, chained = false) {
  const start = chained ? 0 : 0
  const dur = chained ? fps * 0.35 : fps * 0.4
  return interpolate(frame, [start, start + dur], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
}

export function slideExit(frame, durationInFrames, transition) {
  const transFrames = transition?.durationFrames ?? 10
  const fadeOutStart = durationInFrames - transFrames
  const exitProgress = interpolate(frame, [fadeOutStart, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })

  const opacity = 1 - exitProgress
  let transform = ''

  const style = transition?.style ?? 'dissolve'
  if (style === 'zoom-through') {
    const scale = interpolate(exitProgress, [0, 1], [1, 1.08])
    transform = `scale(${scale})`
  } else if (style === 'radial-wipe') {
    const scale = interpolate(exitProgress, [0, 1], [1, 0.96])
    transform = `scale(${scale})`
  }

  return { opacity, transform }
}

export function getZoomKeyframes(frame, fps, durationInFrames, chained) {
  const enterEnd = fps * 0.8
  const holdEnd = durationInFrames - fps * 0.5

  if (chained) {
    return {
      scale: interpolate(frame, [0, enterEnd], [1.02, 1.0], { extrapolateRight: 'clamp' }),
      panX: 0,
      panY: interpolate(frame, [0, enterEnd], [-8, 0], { extrapolateRight: 'clamp' }),
    }
  }

  return {
    scale: interpolate(
      frame,
      [0, enterEnd, holdEnd, durationInFrames],
      [1.08, 1.0, 1.0, 1.02],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
    ),
    panX: 0,
    panY: interpolate(frame, [0, enterEnd], [-4, 0], { extrapolateRight: 'clamp' }),
  }
}

const CURSOR_HOTSPOT = 4

export function DemoCursor({ x, y, opacity, scale = 1 }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x - CURSOR_HOTSPOT * scale,
        top: y - CURSOR_HOTSPOT * scale,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: '0 0',
        zIndex: 30,
        pointerEvents: 'none',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 4 L4 19 L8.5 14.5 L11.5 21 L14.5 19 L10.5 12.5 L19 11.5 Z"
          fill="#000"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

export function ClickRipple({ x, y, progress, color = 'rgba(255,255,255,0.6)' }) {
  const scale = interpolate(progress, [0, 1], [0.15, 2.5])
  const opacity = interpolate(progress, [0, 0.3, 1], [0.5, 0.3, 0])
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 22,
        top: y - 22,
        width: 44,
        height: 44,
        borderRadius: '50%',
        border: `2px solid ${color}`,
        transform: `scale(${scale})`,
        opacity,
        pointerEvents: 'none',
        zIndex: 29,
      }}
    />
  )
}

export const PREVIEW_W = 900
export const PREVIEW_H = 420
