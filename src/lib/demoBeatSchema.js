/**
 * Remotion demo beat DSL — frame-accurate instructions from the story agent.
 *
 * Each beat is a discrete direction Remotion can execute:
 * show/hide refs, camera, cursor, element scale, UI state patches.
 */

import { matchRef, resolveRef } from './demoElementRegistry.js'
import { posForElement, posForRole, cameraPanForFocus } from './demoLayout.js'

const BEAT_CAMERA = {
  establish: { scale: 1.0, focus: 'main' },
  isolate: { scale: 1.32, focus: 'target' },
  hover: { scale: 1.34, focus: 'target' },
  click: { scale: 1.36, focus: 'target' },
  reveal: { scale: 1.14, focus: 'target' },
  hide: { scale: 1.08, focus: 'main' },
  type: { scale: 1.28, focus: 'target' },
  expand: { scale: 1.26, focus: 'target' },
  select: { scale: 1.24, focus: 'target' },
  submit: { scale: 1.18, focus: 'target' },
  payoff: { scale: 1.06, focus: 'main' },
}

const BEAT_FX = {
  hover: { targetScale: 1.08 },
  click: { targetScale: 0.96 },
}

function clampAt(at) {
  return Math.max(0, Math.min(6, Number(at) || 0))
}

function normalizeBeat(raw, registry) {
  if (!raw || typeof raw !== 'object') return null

  const beat = raw.beat ?? raw.phase ?? 'establish'
  const explicitRef =
    raw.targetRef ?? raw.element?.ref ?? raw.target?.ref ?? null
  const targetRef =
    explicitRef ??
    matchRef(registry, {
      component: raw.element?.component ?? raw.target?.component,
      role: raw.focusTarget ?? raw.target?.role ?? raw.element?.role,
      label: raw.element?.label ?? raw.target?.label,
      id: raw.element?.id ?? raw.target?.id,
    })

  return {
    at: clampAt(raw.at ?? raw.timing ?? 0),
    beat,
    targetRef: targetRef ?? null,
    show: Array.isArray(raw.show) ? raw.show : raw.showRefs ?? [],
    hide: Array.isArray(raw.hide) ? raw.hide : raw.hideRefs ?? [],
    reveal: Array.isArray(raw.reveal) ? raw.reveal : raw.revealRefs ?? [],
    hideRest: Boolean(raw.hideRest ?? (beat === 'isolate' || beat === 'hover')),
    camera: { ...BEAT_CAMERA[beat], ...(raw.camera ?? {}) },
    cursor: {
      hover: beat === 'hover' || raw.cursor?.hover,
      click: beat === 'click' || beat === 'submit' || raw.cursor?.click,
      ...(raw.cursor ?? {}),
    },
    fx: { ...(BEAT_FX[beat] ?? {}), ...(raw.fx ?? {}) },
    state: raw.state ?? {},
    demoText: raw.demoText ?? raw.text ?? null,
    description: raw.description ?? '',
  }
}

export function normalizeDemoBeats(rawBeats, registry) {
  if (!Array.isArray(rawBeats)) return []
  return rawBeats
    .map((b) => normalizeBeat(b, registry))
    .filter(Boolean)
    .sort((a, b) => a.at - b.at)
    .slice(0, 16)
}

/** Convert legacy interactionPlan → demoBeats for backward compatibility. */
export function interactionPlanToBeats(plan, registry) {
  if (!Array.isArray(plan) || plan.length === 0) return []
  return normalizeDemoBeats(
    plan.map((p) => ({
      at: p.at,
      beat: p.phase,
      targetRef: p.element?.ref ?? matchRef(registry, p.element ?? { role: p.focusTarget }),
      show: p.show ?? (p.phase === 'isolate' || p.phase === 'hover' ? [] : undefined),
      hideRest: p.phase === 'isolate' || p.phase === 'hover',
      demoText: p.demoText,
      description: p.description,
      state:
        p.phase === 'click' && p.effect === 'openModal'
          ? { redirectOpen: true, scheduleOpen: true }
          : p.state ?? {},
    })),
    registry,
  )
}

function beatsUpTo(beats, t) {
  const applied = []
  for (const b of beats) {
    if (b.at <= t + 0.001) applied.push(b)
    else break
  }
  return applied
}

function activeBeat(beats, t) {
  let current = beats[0] ?? null
  for (const b of beats) {
    if (b.at <= t) current = b
    else break
  }
  return current
}

function nextBeat(beats, t) {
  return beats.find((b) => b.at > t) ?? null
}

function ease(p) {
  return p * p * (3 - 2 * p)
}

/**
 * Resolve cumulative demo state from beats at time t (seconds).
 */
export function deriveStateFromBeats(beats, t, frame, fps, registry) {
  const applied = beatsUpTo(beats, t)
  const current = activeBeat(beats, t)
  const next = nextBeat(beats, t)

  const hiddenRefs = new Set()
  const revealedRefs = new Set()
  let showRefs = []
  let hideRest = false
  let focusRef = null
  let targetScale = 1
  let camera = { scale: 1, focus: 'main' }
  let cursor = { hover: false, click: false }
  let uiState = {
    redirectOpen: false,
    scheduleOpen: false,
    menuOpen: false,
    revealStep: -1,
    dropdownOpen: false,
    showPayoff: false,
  }
  let demoText = ''
  let typeStartSec = null

  for (const b of applied) {
    if (b.targetRef) focusRef = b.targetRef
    if (b.hideRest) hideRest = true
    if (b.show?.length) {
      showRefs = b.show
      hideRest = true
    }
    for (const r of b.hide ?? []) hiddenRefs.add(r)
    for (const r of b.reveal ?? []) {
      revealedRefs.add(r)
      hiddenRefs.delete(r)
    }
    if (b.camera) camera = { ...camera, ...b.camera }
    if (b.fx?.targetScale != null) targetScale = b.fx.targetScale
    if (b.cursor?.hover) cursor.hover = true
    if (b.cursor?.click) cursor.click = true
    if (b.state) uiState = { ...uiState, ...b.state }
    if (b.demoText) demoText = b.demoText
    if (b.beat === 'type') typeStartSec = b.at
    if (b.beat === 'payoff') uiState.showPayoff = true

    if (b.beat === 'reveal') {
      hideRest = false
      uiState.revealStep = Math.max(uiState.revealStep ?? -1, 0)
    }
    if (b.beat === 'type') uiState.revealStep = Math.max(uiState.revealStep ?? -1, 1)
    if (b.beat === 'expand') uiState.revealStep = Math.max(uiState.revealStep ?? -1, 2)
    if (b.beat === 'select') {
      uiState.revealStep = Math.max(uiState.revealStep ?? -1, 2)
      uiState.dropdownOpen = true
    }
    if (b.beat === 'submit') uiState.revealStep = 3
    if (b.beat === 'click') {
      uiState.open = true
      if (focusRef?.includes('redirect') || focusRef?.includes('Redirect')) {
        uiState.redirectOpen = true
      } else {
        uiState.scheduleOpen = true
      }
    }
    if (b.beat === 'expand') uiState.expanded = true
  }

  // Interpolate scale between beats
  if (next && current && next.at > current.at) {
    const span = next.at - current.at
    const p = ease(Math.min(1, Math.max(0, (t - current.at) / span)))
    const fromScale = current.fx?.targetScale ?? 1
    const toScale = next.fx?.targetScale ?? fromScale
    targetScale = fromScale + (toScale - fromScale) * p
    camera.scale = (current.camera?.scale ?? 1) + ((next.camera?.scale ?? 1) - (current.camera?.scale ?? 1)) * p
  }

  const focusEl = focusRef ? resolveRef(focusRef, registry) : null

  const typedText =
    typeStartSec != null && demoText
      ? demoText.slice(0, Math.floor(Math.max(0, frame - typeStartSec * fps) / (fps * 0.07)))
      : uiState.showPayoff
        ? demoText
        : ''

  const modalOpen = uiState.redirectOpen || uiState.scheduleOpen
  const revealAt = applied.find((b) => b.beat === 'reveal')?.at
  let modalEntrance = 0
  if (modalOpen) {
    if (revealAt != null && t >= revealAt) {
      modalEntrance = Math.min(1, (t - revealAt) / 0.35)
    } else if (t >= (applied.find((b) => b.beat === 'click')?.at ?? 0)) {
      modalEntrance = 1
    }
  }

  return {
    demoBeats: true,
    activeBeat: current?.beat ?? null,
    focusRef,
    focusTarget: focusEl?.role ?? 'main',
    highlightTarget: focusEl?.role ?? null,
    hideRest,
    showRefs,
    hiddenRefs: [...hiddenRefs],
    revealedRefs: [...revealedRefs],
    targetScale,
    camera,
    cursor,
    demoPhase: current?.beat ?? null,
    open: modalOpen,
    redirectOpen: uiState.redirectOpen,
    scheduleOpen: uiState.scheduleOpen,
    menuOpen: uiState.menuOpen,
    modalEntrance,
    revealStep: uiState.revealStep ?? -1,
    dropdownOpen: uiState.dropdownOpen ?? false,
    showPayoff: uiState.showPayoff ?? false,
    demoHoverTrigger: cursor.hover && focusEl?.role === 'trigger',
    typedText,
    redirectTypedText: uiState.redirectOpen ? typedText : '',
    hoverInput: current?.beat === 'type' || (typeStartSec != null && t >= typeStartSec && t < typeStartSec + 1.5),
    demoHoverSubmit: current?.beat === 'submit',
    demoHoverDropdown: current?.beat === 'select',
    demoHoverExpand: current?.beat === 'expand' || uiState.expanded,
    expanded: uiState.expanded ?? false,
    isolateSpotlight: hideRest && ['establish', 'isolate', 'hover'].includes(current?.beat) && !modalOpen,
    demoText,
  }
}

export function demoDurationFromBeats(beats, minSec = 4, maxSec = 8) {
  if (!beats?.length) return minSec
  const lastAt = Math.max(...beats.map((b) => b.at))
  return Math.min(maxSec, Math.max(minSec, lastAt + 1.4))
}

export function buildCursorKeyframesFromBeats(beats, registry, context = {}) {
  const sourceByComponent = context.sourceByComponent ?? {}
  const keyframes = [{ t: 0, x: 50, y: 42 }]

  for (const b of beats) {
    if (!['hover', 'click', 'type', 'select', 'submit', 'reveal', 'expand'].includes(b.beat)) continue
    const el = b.targetRef ? resolveRef(b.targetRef, registry) : null
    const pos = posForElement(el, {
      ...context,
      sourceByComponent,
      source: el?.component ? sourceByComponent[el.component] : undefined,
    })

    if (b.beat === 'hover') keyframes.push({ t: b.at, x: pos.x, y: pos.y, hover: true })
    else if (b.beat === 'click' || b.beat === 'submit') {
      keyframes.push({ t: Math.max(0, b.at - 0.1), x: pos.x, y: pos.y, hover: true })
      keyframes.push({ t: Math.max(0, b.at - 0.04), x: pos.x, y: pos.y })
      keyframes.push({ t: b.at, x: pos.x, y: pos.y, click: true })
    } else {
      keyframes.push({ t: Math.max(0, b.at - 0.06), x: pos.x, y: pos.y })
      keyframes.push({ t: b.at, x: pos.x, y: pos.y })
    }
  }

  const last = keyframes[keyframes.length - 1]
  keyframes.push({ t: (beats[beats.length - 1]?.at ?? 3) + 0.6, x: last.x, y: last.y })
  return keyframes
}

export function formatBeatsForPrompt(beats) {
  return beats
    .map((b) => {
      const parts = [`${b.at}s ${b.beat}`]
      if (b.targetRef) parts.push(`→ ${b.targetRef}`)
      if (b.hideRest) parts.push('hideRest')
      if (b.show?.length) parts.push(`show=[${b.show.join(',')}]`)
      if (b.description) parts.push(`"${b.description}"`)
      return parts.join(' ')
    })
    .join('\n')
}
