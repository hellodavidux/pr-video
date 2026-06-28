import { resolveDemoComponent } from './componentCatalog.js'

const MAX_DEMO_BEATS = 6

const LAYOUT_BY_BEAT_TYPE = {
  type: 'input',
  click: 'input',
  select: 'input',
  reveal: 'response',
  display: 'response',
  modal: 'code-depth',
}

const CHAIN_CAMERA = { scale: 1.02, panX: 0, panY: -8, origin: '50% 42%' }

function inferLayout(beat, index, total) {
  if (beat.layout) return beat.layout
  if (beat.beatType && LAYOUT_BY_BEAT_TYPE[beat.beatType]) {
    return LAYOUT_BY_BEAT_TYPE[beat.beatType]
  }
  if (index === total - 1 && beat.codePaths?.length) return 'code-depth'
  return index === 0 ? 'input' : 'response'
}

function inferBeatType(beat, componentMeta) {
  if (beat.beatType) return beat.beatType
  const caps = new Set(componentMeta?.capabilities ?? [])
  if (caps.has('type')) return 'type'
  if (caps.has('open')) return 'click'
  if (caps.has('expand') || caps.has('select')) return 'select'
  if (caps.has('display')) return 'reveal'
  return 'reveal'
}

function extractCodePaths(prData, catalog) {
  const names = []
  for (const c of catalog) {
    if (/Error|Validator|Service|Handler|Controller/i.test(c.name)) {
      names.push(c.name)
    }
  }
  for (const f of prData?.changedFiles ?? []) {
    const path = typeof f === 'string' ? f : f.filename
    const base = path?.split('/').pop()?.replace(/\.\w+$/, '')
    if (base && /^[A-Z]/.test(base) && base.length < 40) names.push(base)
  }
  return [...new Set(names)].slice(0, 4)
}

function fallbackBeats(catalog, plan, prData) {
  const changed = catalog.filter((c) => c.changedInPR)
  const pool = changed.length > 0 ? changed : catalog
  const picks = pool.slice(0, 4)
  const codePaths = extractCodePaths(prData, catalog)

  if (picks.length === 0) {
    return [{
      beatType: 'reveal',
      layout: 'response',
      headline: plan?.keyBenefit ?? 'Something new is here',
      narration: '',
      codePaths,
    }]
  }

  return picks.map((c, i) => {
    const caps = new Set(c.capabilities ?? [])
    let beatType = 'reveal'
    if (caps.has('type') && i === 0) beatType = 'type'
    else if (caps.has('open')) beatType = 'click'
    else if (caps.has('expand')) beatType = 'select'

    return {
      component: c.name,
      beatType,
      layout: inferLayout({ beatType }, i, picks.length),
      headline: c.name.replace(/([A-Z])/g, ' $1').trim(),
      narration: '',
      userQuery: null,
      codePaths: i === picks.length - 1 ? codePaths : [],
      focusTarget: beatType === 'type' ? 'input' : 'main',
    }
  })
}

/**
 * Expand planner output into a fixed Linear-style slide sequence.
 */
export function applyVideoTemplate({ plan, prData, catalog = [] }) {
  const beats = Array.isArray(plan?.beats) && plan.beats.length > 0
    ? plan.beats.slice(0, MAX_DEMO_BEATS)
    : fallbackBeats(catalog, plan, prData)

  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))
  const slides = []
  let prevId = null

  slides.push({
    id: 's0',
    role: 'hero',
    type: 'title',
    layout: 'linear-hero',
    headline: plan?.headline ?? plan?.hook ?? 'Now available',
    durationSec: 3,
    transition: { style: 'zoom-through', durationFrames: 12 },
  })

  beats.forEach((beat, i) => {
    const id = `s${i + 1}`
    const resolvedComponent = resolveDemoComponent(beat.component, catalog)
    const meta = resolvedComponent ? byName[resolvedComponent] : null
    const beatType = inferBeatType(beat, meta)
    const layout = inferLayout(beat, i, beats.length)

    slides.push({
      id,
      role: 'demo',
      type: 'demo',
      layout: `linear-${layout}`,
      beatType,
      storyBeat: beat.storyBeat ?? null,
      headline: beat.headline ?? beat.narration ?? meta?.name ?? 'Demo',
      narration: beat.narration ?? '',
      userQuery: beat.userQuery ?? beat.narration ?? null,
      component: resolvedComponent ?? beat.component ?? meta?.name,
      componentHint: resolvedComponent ?? beat.component ?? meta?.name,
      renderMode: beat.renderMode ?? null,
      contextPage: beat.contextPage ?? null,
      codePaths: beat.codePaths ?? [],
      focus:
        beat.renderMode === 'page'
          ? 'page'
          : beat.renderMode === 'isolated'
            ? 'isolated'
            : beat.focus ?? (meta?.kind === 'page' ? 'page' : 'isolated'),
      focusTarget: beat.focusTarget ?? (beatType === 'type' ? 'input' : 'main'),
      continuesFrom: prevId,
      sharedViewport: i > 0,
      chainCamera: CHAIN_CAMERA,
      interactionPlan: beat.interactionPlan ?? [],
      demoText: beat.demoText ?? null,
      durationSec: 5,
      transition: { style: i === beats.length - 1 ? 'radial-wipe' : 'dissolve', durationFrames: 10 },
    })
    prevId = id
  })

  const payoffWords = String(plan?.keyBenefit ?? 'Ship faster now.')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)

  slides.push({
    id: `s${beats.length + 1}`,
    role: 'payoff',
    type: 'text',
    layout: 'linear-payoff',
    headline: payoffWords.join(' '),
    durationSec: 4,
    transition: { style: 'dissolve', durationFrames: 10 },
  })

  slides.push({
    id: `s${beats.length + 2}`,
    role: 'outro',
    type: 'title',
    layout: 'linear-outro',
    headline: null,
    durationSec: 3,
    transition: { style: 'dissolve', durationFrames: 8 },
  })

  return slides
}

export { MAX_DEMO_BEATS, CHAIN_CAMERA }
