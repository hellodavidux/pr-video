import { memo, useEffect, useMemo, useState } from 'react'
import { continueRender, delayRender } from 'remotion'
import { buildStylesheetFromConfig } from '../lib/previewStyles.js'
import { resolvePreviewSlideId } from '../lib/slideUtils.js'
import { getPrLiveComponent, hasPrLiveComponent } from './prLiveRegistry.jsx'
import { HeroRevealDriver } from './primitives/HeroRevealDriver.jsx'

const TAILWIND_CDN = 'https://cdn.tailwindcss.com'

function ensureTailwind(config) {
  if (window.__prTailwindReady) return Promise.resolve()

  return new Promise((resolve) => {
    const existing = document.getElementById('pr-tailwind-cdn')
    if (existing) {
      const wait = () => {
        if (window.__prTailwindReady) resolve()
        else setTimeout(wait, 50)
      }
      wait()
      return
    }

    window.tailwind = { config: config ?? { important: '#pr-preview-root' } }

    const script = document.createElement('script')
    script.id = 'pr-tailwind-cdn'
    script.src = TAILWIND_CDN
    script.onload = () => {
      window.__prTailwindReady = true
      resolve()
    }
    document.head.appendChild(script)
  })
}

/**
 * Renders a PR component from the static pr-live registry. Components are
 * bundled into Remotion at build time — same path for preview and MP4 export.
 */
const GeneratedPreview = memo(function GeneratedPreview({ preview, demoState, heroReveal }) {
  const slideId = useMemo(() => resolvePreviewSlideId(preview), [preview])
  const registryVersion = preview?.registryVersion ?? 0
  const [stylesReady, setStylesReady] = useState(false)

  const themeStyles = useMemo(() => {
    const fromConfig = buildStylesheetFromConfig(preview?.tailwindConfig)
    return [preview?.styles, fromConfig].filter(Boolean).join('\n')
  }, [preview?.styles, preview?.tailwindConfig])

  const Comp = slideId ? getPrLiveComponent(slideId) : null
  const missing =
    slideId &&
    !Comp &&
    registryVersion > 0 &&
    !hasPrLiveComponent(slideId)

  useEffect(() => {
    if (!slideId || !Comp) {
      setStylesReady(false)
      return
    }

    let cancelled = false
    const handle = delayRender('Loading PR component styles')
    setStylesReady(false)

    ensureTailwind(preview.tailwindConfig)
      .then(() => {
        if (!cancelled) setStylesReady(true)
      })
      .finally(() => continueRender(handle))

    return () => {
      cancelled = true
      continueRender(handle)
    }
  }, [slideId, registryVersion, Comp, preview?.tailwindConfig])

  if (!slideId) return null

  if (missing) {
    return (
      <div
        style={{
          color: '#fca5a5',
          background: '#1a0000',
          padding: 12,
          fontSize: 11,
          fontFamily: 'monospace',
        }}
      >
        Component not found for slide {slideId}. Re-run component extraction.
      </div>
    )
  }

  if (!Comp || !stylesReady) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 360,
          color: 'rgba(255,255,255,0.35)',
          fontSize: 13,
        }}
      >
        Loading component…
      </div>
    )
  }

  return (
    <div key={`${slideId}-${registryVersion}`} style={{ width: '100%', height: '100%', minHeight: 360, overflow: 'auto' }}>
      {themeStyles && <style dangerouslySetInnerHTML={{ __html: themeStyles }} />}
      <Comp demoState={demoState ?? {}} />
      {heroReveal?.enabled && (
        <HeroRevealDriver
          enabled
          startFrame={heroReveal.startFrame}
          staggerFrames={heroReveal.staggerFrames}
          revealFrames={heroReveal.revealFrames}
        />
      )}
    </div>
  )
})

export default GeneratedPreview
