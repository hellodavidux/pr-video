import { MAX_DEMO_BEATS } from './videoTemplate'
import { bindInteractionPlanToScene, buildDemoScene } from './demoScene.js'
import { resolveDemoComponent } from './componentCatalog.js'
import { normalizeInteractionPlan } from './storyPlan.js'

const MAX_ACTIONS = 12
const VALID_ACTION_TYPES = new Set(['idle', 'hover', 'click', 'focus', 'type'])
const VALID_TARGETS = new Set(['trigger', 'input', 'submit', 'expand', 'dropdown', 'row', 'main', 'button'])
const VALID_EFFECTS = new Set(['openModal', 'closeModal', 'typeText', 'expandRow', 'openDropdown', 'select'])
const VALID_LAYOUTS = new Set(['input', 'response', 'code-depth'])

function clampInteractionPlan(plan) {
  return normalizeInteractionPlan(plan)
}

function clampActions(actions) {
  if (!Array.isArray(actions)) return []
  return actions
    .filter((a) => a && VALID_ACTION_TYPES.has(a.type))
    .slice(0, MAX_ACTIONS)
    .map((a, i) => ({
      at: typeof a.at === 'number' ? Math.max(0, Math.min(5, a.at)) : i * 0.7,
      type: a.type,
      target: VALID_TARGETS.has(a.target) ? a.target : 'main',
      ...(a.text ? { text: String(a.text).slice(0, 60) } : {}),
      ...(a.effect && VALID_EFFECTS.has(a.effect) ? { effect: a.effect } : {}),
    }))
}

function fuzzyMatchComponent(name, catalog) {
  if (!name) return undefined
  const exact = catalog.find((c) => c.name === name)
  if (exact) return exact.name
  return catalog.find(
    (c) =>
      c.name.toLowerCase() === String(name).toLowerCase() ||
      c.path.toLowerCase().includes(String(name).toLowerCase()),
  )?.name
}

function validateDemoChain(slides) {
  const demoSlides = slides.filter((s) => s.role === 'demo' || s.type === 'demo')
  const ids = new Set(slides.map((s) => s.id))

  for (let i = 0; i < demoSlides.length; i++) {
    const slide = demoSlides[i]
    if (i === 0) {
      if (slide.continuesFrom != null) slide.continuesFrom = null
      continue
    }
    const prev = demoSlides[i - 1]
    if (!slide.continuesFrom || !ids.has(slide.continuesFrom)) {
      slide.continuesFrom = prev.id
    }
    slide.sharedViewport = true
  }

  return slides
}

function trimDemoBeats(slides) {
  const demos = slides.filter((s) => s.role === 'demo' || s.type === 'demo')
  if (demos.length <= MAX_DEMO_BEATS) return slides

  const drop = new Set(demos.slice(MAX_DEMO_BEATS).map((s) => s.id))
  return slides.filter((s) => !drop.has(s.id))
}

/**
 * Normalize script output: enforce beat limits, chain demos, valid components.
 */
export function validateAndNormalizeScript(script, catalog = []) {
  const names = new Set(catalog.map((c) => c.name))
  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))

  let slides = Array.isArray(script.slides) ? [...script.slides] : []
  slides = trimDemoBeats(slides)

  slides = slides.map((slide) => {
    const isDemo = slide.role === 'demo' || slide.type === 'demo'
    if (!isDemo) return slide

    let component = slide.component ?? slide.componentHint
    component = resolveDemoComponent(component, catalog) ?? fuzzyMatchComponent(component, catalog)

    const meta = component ? byName[component] : null
    const demoScene = slide.demoScene ?? (component ? buildDemoScene(component, catalog, {
      renderMode: slide.renderMode ?? 'auto',
    }) : null)
    const interactionPlan = clampInteractionPlan(
      bindInteractionPlanToScene(slide.interactionPlan, demoScene),
    )
    const focus =
      slide.focus === 'page' || slide.focus === 'isolated'
        ? slide.focus
        : meta?.kind === 'page'
          ? 'page'
          : 'isolated'

    let layout = slide.layout
    if (layout?.startsWith('linear-')) {
      // keep as-is
    } else if (slide.layout && VALID_LAYOUTS.has(slide.layout)) {
      layout = `linear-${slide.layout}`
    }

    return {
      ...slide,
      type: 'demo',
      role: slide.role ?? 'demo',
      ...(layout ? { layout } : {}),
      ...(component ? { component, componentHint: component } : {}),
      focus,
      focusTarget: slide.focusTarget ?? 'main',
      storyBeat: slide.storyBeat ?? null,
      renderMode: slide.renderMode ?? demoScene?.renderMode ?? null,
      contextPage: slide.contextPage ?? null,
      ...(demoScene ? { demoScene } : {}),
      ...(slide.focusComponent ? { focusComponent: slide.focusComponent } : {}),
      interactionPlan,
      actions: clampActions(slide.actions),
    }
  })

  slides = validateDemoChain(slides)

  return {
    ...script,
    slides,
    hashtags: Array.isArray(script.hashtags) ? script.hashtags : [],
    confidence: typeof script.confidence === 'number' ? script.confidence : 0.5,
  }
}

export { MAX_DEMO_BEATS as MAX_BEATS, MAX_ACTIONS }
