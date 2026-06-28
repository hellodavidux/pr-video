import { normalizeInteractionPlan } from './storyPlan.js'

function phaseAt(phases, name) {
  return phases.find((p) => p.phase === name)?.at ?? null
}

function phaseAtTarget(phases, target) {
  return phases.find((p) => p.focusTarget === target)?.at ?? null
}

/**
 * Source-of-truth timings from the agent interaction plan → Remotion demoState.
 */
export function buildPhaseTimeline(interactionPlan, actions = []) {
  const phases = normalizeInteractionPlan(interactionPlan)
  const sorted = [...actions].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))

  const hoverAt =
    phaseAt(phases, 'hover') ??
    sorted.find((a) => a.type === 'hover')?.at ??
    null

  const openAt =
    phaseAt(phases, 'click') ??
    sorted.find((a) => a.effect === 'openModal' || (a.type === 'click' && a.target === 'trigger'))?.at ??
    null

  const typeAt =
    phaseAt(phases, 'type') ??
    sorted.find((a) => a.type === 'type' || a.effect === 'typeText')?.at ??
    null

  const dropdownAt =
    phaseAt(phases, 'select') ??
    sorted.find((a) => a.effect === 'openDropdown' || (a.type === 'click' && a.target === 'dropdown'))?.at ??
    null

  const submitAt =
    phaseAt(phases, 'submit') ??
    sorted.find((a) => a.effect === 'closeModal' || (a.type === 'click' && a.target === 'submit'))?.at ??
    null

  const payoffAt = phaseAt(phases, 'payoff') ?? (submitAt != null ? submitAt + 0.45 : null)

  const expandAt =
    phaseAtTarget(phases, 'expand') ??
    sorted.find((a) => a.effect === 'expandRow' || (a.type === 'click' && a.target === 'expand'))?.at ??
    null

  return {
    phases,
    hoverAt,
    openAt,
    typeAt,
    dropdownAt,
    submitAt,
    payoffAt,
    expandAt,
  }
}

export function highlightTargetForTime(timeline, t) {
  const { phases } = timeline
  if (!phases.length) return null

  let current = phases[0]
  for (const p of phases) {
    if (p.at <= t) current = p
    else break
  }

  if (current.phase === 'hover' || current.phase === 'isolate' || current.phase === 'click') {
    return current.focusTarget ?? current.element?.role ?? null
  }
  if (current.phase === 'type') return 'input'
  if (current.phase === 'select') return 'dropdown'
  if (current.phase === 'submit') return 'submit'
  return current.focusTarget ?? null
}

export function revealStepForPhase(storyPhase, timeStep) {
  const byPhase = {
    establish: -1,
    isolate: -1,
    hover: -1,
    click: 0,
    reveal: 0,
    type: 1,
    expand: 2,
    select: 2,
    submit: 3,
    payoff: 3,
  }
  const fromPhase = storyPhase?.phase ? byPhase[storyPhase.phase] ?? -1 : -1
  if (fromPhase >= 0 && (timeStep ?? -1) < 0) return fromPhase
  return Math.max(timeStep ?? -1, fromPhase)
}
