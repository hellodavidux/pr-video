export const PR_VIDEO_FPS = 30
export const SLIDE_DURATION_FRAMES = 4 * PR_VIDEO_FPS
export const COMPOSITION_WIDTH = 1920
export const COMPOSITION_HEIGHT = 1080
export const MIN_VIDEO_SECONDS = 8
export const MAX_VIDEO_SECONDS = 90

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max)
}

export function computePrMetrics(pr) {
  const files = pr?.files ?? []
  const totalChanges = files.reduce(
    (n, f) => n + (f.additions ?? 0) + (f.deletions ?? 0),
    0
  )
  const fileCount = files.length
  const sizeFactor = clamp(totalChanges / 400, 0.75, 1.35)
  return { totalChanges, fileCount, sizeFactor }
}

export function getSlideDurationFrames(slide, prMetrics, options = {}) {
  const fps = PR_VIDEO_FPS
  const { screenshotCount = 1, hasBodySummary = false } = options
  const visualType = slide.visual?.type ?? 'code-change'
  const lineCount = slide.visual?.highlightLines?.length ?? 0
  const lineBonus = Math.floor(lineCount / 5) * (fps * 0.5)

  if (visualType === 'hero') {
    let base = 3 * fps
    if (hasBodySummary) base += fps
    return base
  }

  if (visualType === 'app-screenshot' || visualType === 'image') {
    let base = 5 * fps
    if (screenshotCount > 1) base += (screenshotCount - 1) * fps
    return Math.round(base * prMetrics.sizeFactor)
  }

  if (visualType === 'component-preview') {
    const base = 4 * fps + Math.min(lineBonus, fps)
    return Math.round(base * prMetrics.sizeFactor)
  }

  if (visualType === 'code-change' || visualType === 'summary') {
    const base = 3.5 * fps + Math.min(lineBonus, 2 * fps)
    return Math.round(base * prMetrics.sizeFactor)
  }

  return Math.round(4 * fps * prMetrics.sizeFactor)
}

export function applySlideDurations(slides, prMetrics, options = {}) {
  const fps = PR_VIDEO_FPS
  const minFrames = MIN_VIDEO_SECONDS * fps
  const maxFrames = MAX_VIDEO_SECONDS * fps

  let result = slides.map((slide) => ({
    ...slide,
    durationFrames: getSlideDurationFrames(slide, prMetrics, options),
  }))

  let total = result.reduce((n, s) => n + s.durationFrames, 0)

  if (total < minFrames) {
    const scale = minFrames / total
    result = result.map((s) => ({
      ...s,
      durationFrames: Math.round(s.durationFrames * scale),
    }))
  } else if (total > maxFrames) {
    const scale = maxFrames / total
    result = result.map((s) => ({
      ...s,
      durationFrames: Math.max(fps, Math.round(s.durationFrames * scale)),
    }))
  }

  return result
}

export function getVideoDurationInFrames(slides) {
  if (!slides?.length) return MIN_VIDEO_SECONDS * PR_VIDEO_FPS
  const total = slides.reduce(
    (n, s) => n + (s.durationFrames ?? SLIDE_DURATION_FRAMES),
    0
  )
  return clamp(total, MIN_VIDEO_SECONDS * PR_VIDEO_FPS, MAX_VIDEO_SECONDS * PR_VIDEO_FPS)
}

export function getEstimatedDurationSec(slides) {
  return Math.round(getVideoDurationInFrames(slides) / PR_VIDEO_FPS)
}
