export function slideDurationSec(slide) {
  if (typeof slide.durationSec === 'number') return slide.durationSec
  if (slide.role === 'hero' || slide.role === 'outro') return 3
  if (slide.role === 'payoff') return 4
  if (slide.type === 'demo' || slide.role === 'demo') return 5
  if (slide.type === 'title') return 2
  return 3
}

/** Remotion requires integer frame counts. */
export function slideDurationFrames(slide, fps) {
  return Math.max(1, Math.round(slideDurationSec(slide) * fps))
}

export function totalDurationFrames(slides, fps) {
  return slides.reduce((acc, slide) => acc + slideDurationFrames(slide, fps), 0)
}
export function isTitleSlide(slide) {
  return slide.type === 'title' && slide.role !== 'hero' && slide.role !== 'outro'
}

export function isDemoSlide(slide) {
  return slide.type === 'demo' || slide.role === 'demo' || Boolean(resolvePreviewSlideId(slide.preview))
}

/** Supports legacy preview.entryUrl sessions stored before the registry refactor. */
export function resolvePreviewSlideId(preview) {
  if (preview?.slideId) return preview.slideId
  const m = String(preview?.entryUrl ?? '').match(/\/pr-live\/([^/?]+)\//)
  return m?.[1] ?? null
}

export function isTextSlide(slide) {
  return !isDemoSlide(slide)
}

export function isLinearTemplateSlide(slide) {
  return Boolean(slide.role || slide.layout?.startsWith('linear-'))
}

export function getDemoSlides(slides) {
  return slides.filter((s) => s.role === 'demo' || s.type === 'demo')
}

/** Staged UI reveal for the hero slide — times in frames. */
export function heroRevealTiming(fps) {
  return {
    startFrame: Math.round(fps * 0.15),
    staggerFrames: Math.round(fps * 0.18),
    revealFrames: Math.round(fps * 0.32),
  }
}
