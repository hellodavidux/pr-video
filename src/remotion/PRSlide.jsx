import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { useMemo } from 'react'
import { resolveLinearLayout } from './layouts/index.jsx'
import { ProductThemeProvider } from './theme/ProductThemeContext.jsx'
import { DEFAULT_THEME } from '../lib/productTheme.js'
import { isDemoSlide, isTitleSlide } from '../lib/slideUtils.js'
import { resolvePreviewSlideId } from '../lib/slideUtils.js'
import { demoFrameFromSlide, deriveDemoState } from '../lib/inferDemoScript.js'
import GeneratedPreview from './GeneratedPreview.jsx'
import { AnimatedBg } from './effects/AnimatedBg.jsx'
import { TextFx } from './effects/TextFx.jsx'
import { HeaderBadge } from './effects/HeaderBadge.jsx'

const T = {
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.55)',
  accent: '#a5b4fc',
  surface: '#1c1c22',
  surfaceBorder: 'rgba(255,255,255,0.08)',
  fontDisplay: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  radius: '18px',
}

function slideTransformOut(frame, durationInFrames, transition) {
  const style = transition?.style ?? 'dissolve'
  const transFrames = transition?.durationFrames ?? 10
  const fadeOutStart = durationInFrames - transFrames
  const exitProgress = interpolate(frame, [fadeOutStart, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  })
  const opacity = 1 - exitProgress
  let transform = ''
  if (style === 'slide-push-left') {
    transform = `translateX(${interpolate(exitProgress, [0, 1], [0, -100])}px)`
  } else if (style === 'zoom-through') {
    transform = `scale(${interpolate(exitProgress, [0, 1], [1, 1.12])})`
  }
  return { opacity, transform }
}

function LegacyTitleSlide({ slide, pr, frame, fps, durationInFrames }) {
  const specs = slide.animationSpecs ?? {}
  const logo = specs.logoUsage
  const accentColor = slide.brand?.accentColor ?? logo?.color ?? T.accent
  const { opacity: exitOpacity, transform: exitTransform } = slideTransformOut(frame, durationInFrames, slide.transition)
  const fadeIn = interpolate(frame, [0, fps * 0.25], [0, 1], { extrapolateRight: 'clamp' })
  const headlineStart = logo ? fps * 0.7 : fps * 0.2

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', fontFamily: T.fontDisplay,
      boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
      opacity: fadeIn * exitOpacity, transform: exitTransform,
    }}>
      <AnimatedBg background={specs.background} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 900 }}>
        <div style={{ fontSize: 84, fontWeight: 800, color: T.text, lineHeight: 1.05, letterSpacing: '-0.03em' }}>
          <TextFx text={slide.headline} effect={specs.textEffect} startFrame={headlineStart} />
        </div>
      </div>
    </div>
  )
}

function LegacyTextSlide({ slide, frame, fps, durationInFrames }) {
  const specs = slide.animationSpecs ?? {}
  const accentColor = slide.brand?.accentColor ?? T.accent
  const { opacity: exitOpacity, transform: exitTransform } = slideTransformOut(frame, durationInFrames, slide.transition)
  const fadeIn = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' })

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '80px 96px',
      fontFamily: T.fontDisplay, boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
      opacity: fadeIn * exitOpacity, transform: exitTransform,
    }}>
      <AnimatedBg background={specs.background} />
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', width: '100%', maxWidth: 960 }}>
        {slide.headerText && <HeaderBadge text={slide.headerText} accentColor={accentColor} startFrame={0} />}
        <div style={{ display: 'block', fontSize: 72, fontWeight: 800, color: T.text, lineHeight: 1.06, letterSpacing: '-0.03em' }}>
          <TextFx text={slide.headline} effect={specs.textEffect} startFrame={fps * 0.2} />
        </div>
      </div>
    </div>
  )
}

function LegacyDemoSlide({ slide, frame, fps, durationInFrames }) {
  const specs = slide.animationSpecs ?? {}
  const hasPreview = Boolean(resolvePreviewSlideId(slide.preview))
  const demoScript = slide.preview?.demoScript
  const demoFrame = demoFrameFromSlide(frame, fps)
  const demoState = useMemo(
    () => (demoScript ? deriveDemoState(demoScript, demoFrame, fps) : {}),
    [demoScript, demoFrame, fps],
  )
  const { opacity: exitOpacity, transform: exitTransform } = slideTransformOut(frame, durationInFrames, slide.transition)
  const fadeIn = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: 'clamp' })
  const ws = spring({ frame: frame - fps * 0.3, fps, config: { damping: 22, stiffness: 100 } })

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: '28px 48px',
      fontFamily: T.fontDisplay, boxSizing: 'border-box', overflow: 'hidden', position: 'relative',
      opacity: fadeIn * exitOpacity, transform: exitTransform,
    }}>
      <AnimatedBg background={specs.background} />
      {hasPreview && (
        <div style={{
          flex: 1, width: '100%', maxWidth: 1200, position: 'relative',
          transform: `translateY(${interpolate(ws, [0, 1], [40, 0])}px)`,
          opacity: interpolate(ws, [0, 1], [0, 1]),
        }}>
          <GeneratedPreview preview={slide.preview} demoState={demoState} />
        </div>
      )}
    </div>
  )
}

export default function PRSlide({ slide, pr, theme }) {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()
  const mergedTheme = { ...DEFAULT_THEME, ...theme, ...(slide.theme ?? {}) }
  const slideWithBrand = { ...slide, brand: slide.brand ?? pr?.brand }

  const LinearLayout = resolveLinearLayout(slide)
  if (LinearLayout) {
    return (
      <ProductThemeProvider theme={mergedTheme}>
        <LinearLayout slide={slideWithBrand} pr={pr} durationInFrames={durationInFrames} />
      </ProductThemeProvider>
    )
  }

  if (isTitleSlide(slide)) {
    return <LegacyTitleSlide slide={slideWithBrand} pr={pr} frame={frame} fps={fps} durationInFrames={durationInFrames} />
  }
  if (isDemoSlide(slide)) {
    return <LegacyDemoSlide slide={slideWithBrand} frame={frame} fps={fps} durationInFrames={durationInFrames} />
  }
  return <LegacyTextSlide slide={slideWithBrand} frame={frame} fps={fps} durationInFrames={durationInFrames} />
}
