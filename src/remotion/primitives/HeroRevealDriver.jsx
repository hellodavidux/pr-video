import { Easing, interpolate, continueRender, delayRender, useCurrentFrame, useVideoConfig } from 'remotion'
import { useLayoutEffect, useRef } from 'react'

const BLOCK_TAGS = new Set([
  'HEADER',
  'SECTION',
  'MAIN',
  'ARTICLE',
  'NAV',
  'ASIDE',
  'FORM',
  'TABLE',
  'THEAD',
  'TBODY',
  'TR',
  'UL',
  'OL',
  'LI',
  'BUTTON',
  'H1',
  'H2',
  'H3',
  'H4',
  'P',
])

const SKIP_TAGS = new Set(['STYLE', 'SCRIPT', 'SVG', 'PATH', 'BR', 'HR'])

function isRevealCandidate(el) {
  if (!(el instanceof HTMLElement)) return false
  if (SKIP_TAGS.has(el.tagName)) return false
  if (el.dataset.heroRevealSkip != null) return false

  const rect = el.getBoundingClientRect()
  if (rect.width < 36 || rect.height < 14) return false

  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false
  }

  return BLOCK_TAGS.has(el.tagName) || el.classList.length > 0
}

function collectRevealTargets(root, max = 12) {
  const candidates = []

  function walk(el, depth) {
    if (depth > 4 || candidates.length >= max) return

    for (const child of el.children) {
      if (!(child instanceof HTMLElement)) continue
      if (isRevealCandidate(child)) {
        candidates.push(child)
        continue
      }
      if (child.children.length > 0 && child.children.length < 24) {
        walk(child, depth + 1)
      }
    }
  }

  walk(root, 0)

  return candidates
    .sort((a, b) => {
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      return ra.top - rb.top || ra.left - rb.left
    })
    .slice(0, max)
}

/**
 * Marks visible UI blocks inside a PR preview and drives per-element opacity
 * from the Remotion timeline — used on the hero slide for a staged reveal.
 */
export function HeroRevealDriver({ enabled, startFrame = 0, staggerFrames, revealFrames }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const markedRef = useRef(false)
  const targetsRef = useRef([])
  const renderHandleRef = useRef(null)

  const stagger = staggerFrames ?? Math.round(fps * 0.18)
  const revealDur = revealFrames ?? Math.round(fps * 0.32)

  useLayoutEffect(() => {
    if (!enabled) {
      markedRef.current = false
      targetsRef.current = []
      if (renderHandleRef.current != null) {
        continueRender(renderHandleRef.current)
        renderHandleRef.current = null
      }
      return
    }

    const root = document.getElementById('pr-preview-root')
    if (!root) return

    if (!markedRef.current) {
      if (renderHandleRef.current == null) {
        renderHandleRef.current = delayRender('Hero reveal targets')
      }

      const targets = collectRevealTargets(root)
      if (targets.length === 0) return

      targets.forEach((el, i) => {
        el.dataset.heroRevealIdx = String(i)
        el.style.willChange = 'opacity, transform'
        el.style.opacity = '0'
        el.style.transform = 'translateY(14px)'
      })
      targetsRef.current = targets
      markedRef.current = true

      if (renderHandleRef.current != null) {
        continueRender(renderHandleRef.current)
        renderHandleRef.current = null
      }
    }

    for (const el of targetsRef.current) {
      const idx = Number(el.dataset.heroRevealIdx ?? 0)
      const itemStart = startFrame + idx * stagger
      const progress = interpolate(frame, [itemStart, itemStart + revealDur], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
        easing: Easing.out(Easing.cubic),
      })
      const y = interpolate(progress, [0, 1], [14, 0])

      el.style.opacity = String(progress)
      el.style.transform = `translateY(${y}px)`
      el.style.pointerEvents = progress < 0.05 ? 'none' : ''
    }
  }, [enabled, frame, startFrame, stagger, revealDur])

  useLayoutEffect(() => {
    return () => {
      if (renderHandleRef.current != null) {
        continueRender(renderHandleRef.current)
        renderHandleRef.current = null
      }
    }
  }, [])

  return null
}
