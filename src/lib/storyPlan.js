/**
 * Converts AI-authored story phases into timed demo actions + camera keyframes.
 * Phases are the narrative DSL; actions are what Remotion executes.
 */

const PHASE_SCALE = {
  establish: 1.0,
  isolate: 1.28,
  hover: 1.32,
  click: 1.35,
  reveal: 1.15,
  type: 1.28,
  expand: 1.28,
  select: 1.26,
  submit: 1.18,
  payoff: 1.06,
}

const PHASE_TO_ACTION = {
  hover: (p) => ({ type: 'hover', target: p.focusTarget ?? p.target ?? 'main' }),
  click: (p) => ({
    type: 'click',
    target: p.focusTarget ?? p.target ?? 'main',
    ...(p.effect ? { effect: p.effect } : {}),
  }),
  type: (p) => ({
    type: 'type',
    target: p.focusTarget ?? p.target ?? 'input',
    text: p.demoText ?? p.text ?? '',
    effect: 'typeText',
  }),
  select: (p) => ({
    type: 'click',
    target: p.focusTarget ?? 'dropdown',
    effect: 'openDropdown',
  }),
  submit: (p) => ({
    type: 'click',
    target: p.focusTarget ?? 'submit',
    effect: p.effect ?? 'closeModal',
  }),
}

function normalizePhase(raw, index) {
  if (!raw || typeof raw !== 'object') return null

  const at =
    typeof raw.at === 'number'
      ? raw.at
      : typeof raw.timing === 'number'
        ? raw.timing
        : parseTimingStart(raw.timing) ?? index * 0.5

  return {
    phase: raw.phase ?? inferPhaseFromDescription(raw.description),
    at: Math.max(0, Math.min(4.5, at)),
    focusTarget: raw.focusTarget ?? raw.target ?? null,
    element:
      raw.element && typeof raw.element === 'object'
        ? {
            component: raw.element.component ?? null,
            role: raw.element.role ?? raw.focusTarget ?? null,
            label: raw.element.label ?? null,
            ...(raw.element.id ? { id: raw.element.id } : {}),
            ...(raw.element.htmlFor ? { htmlFor: raw.element.htmlFor } : {}),
          }
        : null,
    description: raw.description ?? '',
    demoText: raw.demoText ?? raw.text ?? null,
    effect: raw.effect ?? null,
    camera: raw.camera ?? null,
    action: raw.action ?? null,
  }
}

function parseTimingStart(timing) {
  if (typeof timing !== 'string') return null
  const m = timing.match(/([\d.]+)/)
  return m ? parseFloat(m[1]) : null
}

function inferPhaseFromDescription(desc) {
  const d = String(desc ?? '').toLowerCase()
  if (/isolate|focus on|zoom.*button|highlight.*button/.test(d)) return 'isolate'
  if (/hover/.test(d)) return 'hover'
  if (/click|press|tap|open modal|\+ new|create new/.test(d)) return 'click'
  if (/modal|dialog|opens|reveals/.test(d)) return 'reveal'
  if (/expand|date range|date picker/.test(d)) return 'expand'
  if (/type|enter|fill|write/.test(d)) return 'type'
  if (/dropdown|select|pick/.test(d)) return 'select'
  if (/submit|save|continue|confirm/.test(d)) return 'submit'
  if (/establish|show|page|context|overview/.test(d)) return 'establish'
  return 'establish'
}

export function normalizeInteractionPlan(plan) {
  if (!Array.isArray(plan)) return []
  return plan.map(normalizePhase).filter(Boolean).slice(0, 10)
}

/**
 * Turn story phases into director actions (deduped, sorted).
 */
export function interactionPlanToActions(plan, slide = {}) {
  const phases = normalizeInteractionPlan(plan)
  const actions = []

  for (const phase of phases) {
    if (phase.action?.type) {
      actions.push({ at: phase.at, ...phase.action })
      continue
    }

    const builder = PHASE_TO_ACTION[phase.phase]
    if (!builder) continue

    const action = builder(phase)
    if (action.type === 'click' && phase.phase === 'click' && !action.effect) {
      if (phase.focusTarget === 'trigger' || phase.description?.toLowerCase().includes('modal')) {
        action.effect = 'openModal'
      }
    }
    if (action.type === 'type' && !action.text && slide.demoText) {
      action.text = slide.demoText
    }
    actions.push({ at: phase.at, ...action })
  }

  // Ensure hover precedes click on same target
  const sorted = [...actions].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  const deduped = []
  const seen = new Set()

  for (const a of sorted) {
    const key = `${a.type}:${a.target}:${a.effect ?? ''}`
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(a)
  }

  return deduped.slice(0, 12)
}

export function buildCameraFromPlan(interactionPlan, mode, posForTarget) {
  const phases = normalizeInteractionPlan(interactionPlan)
  if (phases.length === 0) return null

  const keyframes = phases
    .filter((p) => p.focusTarget || p.camera?.target || PHASE_SCALE[p.phase])
    .map((p) => {
      const target = p.camera?.target ?? p.focusTarget ?? 'main'
      return {
        t: p.at,
        target,
        scale: p.camera?.scale ?? PHASE_SCALE[p.phase] ?? 1.08,
        padding: p.phase === 'establish' ? 44 : p.phase === 'isolate' ? 28 : 32,
        phase: p.phase,
      }
    })

  if (keyframes.length === 0) return null

  // Always start wide if first phase isn't establish
  if (keyframes[0].phase !== 'establish' && keyframes[0].t > 0.05) {
    keyframes.unshift({ t: 0, target: 'main', scale: 1.0, padding: 44, phase: 'establish' })
  }

  return { keyframes }
}

export function storyPhaseAt(interactionPlan, t) {
  const phases = normalizeInteractionPlan(interactionPlan)
  if (phases.length === 0) return null

  let current = phases[0]
  for (const p of phases) {
    if (p.at <= t) current = p
    else break
  }
  return current
}

export function demoDurationFromPlan(plan, minSec = 4, maxSec = 6) {
  const phases = normalizeInteractionPlan(plan)
  if (phases.length === 0) return minSec
  const lastAt = Math.max(...phases.map((p) => p.at))
  return Math.min(maxSec, Math.max(minSec, lastAt + 1.2))
}

export { PHASE_SCALE }
