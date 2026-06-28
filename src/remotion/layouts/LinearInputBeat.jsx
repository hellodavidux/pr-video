import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { DepthOfField, RadialGlow } from '../primitives/DepthOfField.jsx'
import { useProductTheme } from '../theme/ProductThemeContext.jsx'
import FloatingDemoSurface from './FloatingDemoSurface.jsx'
import { slideEnterOpacity, slideExit } from './shared.jsx'

export default function LinearInputBeat({ slide, durationInFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const theme = useProductTheme()
  const chained = Boolean(slide.continuesFrom)
  const { opacity: exitOpacity, transform: exitTransform } = slideExit(frame, durationInFrames, slide.transition)
  const enter = slideEnterOpacity(frame, fps, chained)

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
      <DepthOfField intensity={0.8}>
        <RadialGlow color={theme.backgroundElevated} />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 64px',
          }}
        >
          <FloatingDemoSurface
            slide={slide}
            frame={frame}
            fps={fps}
            durationInFrames={durationInFrames}
            chained={chained}
          />
        </div>
      </DepthOfField>
    </div>
  )
}
