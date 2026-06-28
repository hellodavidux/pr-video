import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { useMemo } from 'react'
import { resolvePreviewSlideId } from '../../lib/slideUtils.js'
import GeneratedPreview from '../GeneratedPreview.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import {
  DEMO_CURSOR_START_SEC,
  demoFrameFromSlide,
  deriveDemoState,
  getCameraTransform,
  getDemoCursorPosition,
} from '../../lib/inferDemoScript.js'
import { DemoCursor, ClickRipple, getZoomKeyframes, PREVIEW_H, PREVIEW_W } from './shared.jsx'

function spotlightPosition(focusTarget, demoScript) {
  const mode = demoScript?.type?.startsWith('page')
    ? 'page'
    : demoScript?.type === 'table'
      ? 'table'
      : 'component'
  const map = {
    page: { trigger: { x: 84, y: 11 }, main: { x: 55, y: 22 }, button: { x: 72, y: 42 } },
    table: { expand: { x: 88, y: 38 }, main: { x: 50, y: 45 } },
    component: { trigger: { x: 70, y: 20 }, main: { x: 50, y: 45 }, button: { x: 70, y: 25 } },
  }[mode] ?? { main: { x: 50, y: 45 } }
  return map[focusTarget] ?? map.main ?? { x: 50, y: 45 }
}

export function FloatingDemoSurface({ slide, frame, fps, durationInFrames, chained, maxWidth = 720 }) {
  const theme = useProductTheme()
  const hasPreview = Boolean(resolvePreviewSlideId(slide.preview))
  const chainZoom = getZoomKeyframes(frame, fps, durationInFrames, chained)

  const cursorStart = fps * DEMO_CURSOR_START_SEC
  const cursorOpacity = interpolate(frame, [cursorStart, cursorStart + fps * 0.2], [0, 1], {
    extrapolateRight: 'clamp',
  })

  const demoScript = slide.preview?.demoScript
  const demoFrame = demoFrameFromSlide(frame, fps)

  const demoState = useMemo(
    () => (demoScript ? deriveDemoState(demoScript, demoFrame, fps) : {}),
    [demoScript, demoFrame, fps],
  )

  const storyCam = demoScript
    ? getCameraTransform(demoScript, demoFrame, fps, durationInFrames - cursorStart)
    : null

  const scale = storyCam?.scale ?? chainZoom.scale
  const panX = storyCam?.panX ?? chainZoom.panX
  const panY = storyCam?.panY ?? chainZoom.panY

  const demoCursor =
    frame > cursorStart && demoScript
      ? getDemoCursorPosition(demoScript, demoFrame, fps)
      : null

  const cursorX = demoCursor ? (demoCursor.x / 100) * PREVIEW_W : PREVIEW_W * 0.35
  const cursorY = demoCursor ? (demoCursor.y / 100) * PREVIEW_H : PREVIEW_H * 0.45
  const cursorScale = demoCursor?.click ? 0.78 : demoCursor?.hover ? 0.92 : 1
  const clickRippleProgress = demoCursor?.clickProgress ?? 0

  const spotlight = demoState.isolateSpotlight
    ? spotlightPosition(demoState.focusTarget, demoScript)
    : null
  const spotlightHole = demoState.demoPhase === 'hover' ? 8 : demoState.demoPhase === 'isolate' ? 10 : 12
  const spotlightDark = demoState.demoPhase === 'hover' ? 0.78 : 0.68

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: -40,
          borderRadius: 24,
          background: `radial-gradient(ellipse at 50% 40%, ${theme.backgroundElevated} 0%, transparent 65%)`,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          position: 'relative',
          borderRadius: theme.radius ?? 10,
          border: `1px solid ${theme.surfaceBorder}`,
          background: theme.surface,
          boxShadow: '0 0 120px rgba(255,255,255,0.03), 0 24px 80px rgba(0,0,0,0.55)',
          overflow: 'hidden',
          minHeight: PREVIEW_H,
        }}
      >
        <div
          style={{
            transform: `scale(${scale}) translate(${panX}px, ${panY}px)`,
            transformOrigin: slide.chainCamera?.origin ?? '50% 42%',
            height: PREVIEW_H,
            transition: 'transform 0.05s linear',
          }}
        >
          {hasPreview ? (
            <GeneratedPreview preview={slide.preview} demoState={demoState} />
          ) : (
            <div
              style={{
                height: PREVIEW_H,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.textMuted,
                fontFamily: theme.fontDisplay,
                fontSize: 14,
              }}
            >
              {slide.component ?? 'Component preview'}
            </div>
          )}
        </div>

        {spotlight && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 20,
              background: `radial-gradient(circle at ${spotlight.x}% ${spotlight.y}%, transparent 0%, transparent ${spotlightHole}%, rgba(0,0,0,${spotlightDark}) 46%)`,
            }}
          />
        )}

        {frame > cursorStart && hasPreview && (
          <>
            <DemoCursor x={cursorX} y={cursorY} opacity={cursorOpacity} scale={cursorScale} />
            {demoCursor?.click && (
              <ClickRipple
                x={cursorX}
                y={cursorY}
                progress={clickRippleProgress}
                color={`${theme.accent}cc`}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default FloatingDemoSurface
