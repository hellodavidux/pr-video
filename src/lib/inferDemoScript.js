import { buildCameraFromPlan, interactionPlanToActions, normalizeInteractionPlan, storyPhaseAt } from './storyPlan.js'
import { buildPhaseTimeline, highlightTargetForTime, revealStepForPhase } from './phaseTimeline.js'
import { defaultActionsForKind } from './directorScript.js'
import { buildElementRegistry } from './demoElementRegistry.js'
import { posForTarget, posForElement, posForRole, cameraPanForFocus, ROLE_LAYOUT } from './demoLayout.js'
import {
  deriveStateFromBeats,
  interactionPlanToBeats,
  normalizeDemoBeats,
  buildCursorKeyframesFromBeats,
} from './demoBeatSchema.js'

const PAGE_FOCUS_RE = /\b(full page|entire screen|whole page|navigate to|overview|dashboard|full screen)\b/i

/** Seconds after slide cursor appears — demoScript times are relative to this. */
export const DEMO_CURSOR_START_SEC = 0.6

export function resolveSlideFocus(slide) {
  if (slide?.focus === 'page' || slide?.focus === 'isolated') return slide.focus
  const text = `${slide?.headline ?? ''} ${slide?.narration ?? ''}`
  return PAGE_FOCUS_RE.test(text) ? 'page' : 'isolated'
}

function findParentPage(component, files, parseExports) {
  for (const [path, source] of files) {
    if (!/(pages|views)\//i.test(path)) continue
    if (!source.includes(component.name)) continue
    const exports = parseExports(source)
    const pageExp = exports.find((e) => /Page$/i.test(e.name))
    if (pageExp) {
      return { path, name: pageExp.name, kind: pageExp.kind, source }
    }
  }
  return null
}

export function findDemoRoot(component, files, parseExports, slide = {}) {
  const focus = resolveSlideFocus(slide)

  if (slide.demoScene?.rootPath) {
    const rootPath = slide.demoScene.rootPath
    const rootSource = files.get(rootPath)
    if (rootSource) {
      const exports = parseExports(rootSource)
      const exp =
        exports.find((e) => e.name === slide.demoScene.rootComponent) ??
        exports.find((e) => /Page$/i.test(e.name)) ??
        exports[0]
      if (exp) {
        return {
          root: { path: rootPath, name: exp.name, kind: exp.kind, source: rootSource },
          mode: slide.demoScene.rootMode ?? 'component',
        }
      }
    }
  }

  if (/Page$/i.test(component.name)) {
    return { root: component, mode: 'page' }
  }

  if (/Table$/i.test(component.name)) {
    return { root: component, mode: 'table' }
  }

  if (/Modal$/i.test(component.name)) {
    const page = findParentPage(component, files, parseExports)
    if (page) return { root: page, mode: 'page' }
    return { root: component, mode: 'modal' }
  }

  if (focus === 'page') {
    const page = findParentPage(component, files, parseExports)
    if (page) return { root: page, mode: 'page' }
  }

  if (/Table$/i.test(component.name)) {
    return { root: component, mode: 'table' }
  }

  return { root: component, mode: 'component' }
}

function narrationMentionsRedirect(narration) {
  return /\bredirect\b/i.test(narration)
}

function narrationMentionsSchedule(narration) {
  return /\b(schedule|availability|hours|standup)\b/i.test(narration)
}

function posForTargetMode(mode, target) {
  return posForTarget(mode, target)
}

function buildSourceByComponent(slide, component) {
  const map = {}
  if (component?.source) map[component.name] = component.source
  for (const c of slide.demoScene?.components ?? []) {
    if (c.name && c.source) map[c.name] = c.source
  }
  return map
}

function demoTextFromActions(actions, slide, componentName, narration) {
  const typeAction = actions.find((a) => a.type === 'type' && a.text)
  if (typeAction?.text) return typeAction.text
  if (slide?.demoText) return slide.demoText

  const text = narration.toLowerCase()
  const isRedirect = /redirect/i.test(componentName) || narrationMentionsRedirect(text)
  return isRedirect ? 'Holiday coverage' : 'Team standup hours'
}

function buildCursorKeyframesFromTimeline(timeline, mode, sortedActions) {
  const { phases } = timeline
  const keyframes = [{ t: 0, x: posForTarget(mode, 'main').x, y: posForTarget(mode, 'main').y }]
  let lastT = 0
  let lastPos = posForTarget(mode, 'main')

  const cursorPhases = phases.filter((p) =>
    ['hover', 'click', 'type', 'expand', 'select', 'submit', 'reveal'].includes(p.phase),
  )

  for (const phase of cursorPhases) {
    const target = phase.focusTarget ?? phase.element?.role ?? 'main'
    const pos = posForTarget(mode, target)
    const t = phase.at ?? 0

    if (t > lastT + 0.12) {
      keyframes.push({ t: Math.max(0, t - 0.12), x: lastPos.x, y: lastPos.y })
    }

    if (phase.phase === 'hover') {
      keyframes.push({ t, x: pos.x, y: pos.y, hover: true })
    } else if (phase.phase === 'click' || phase.phase === 'submit') {
      keyframes.push({ t: Math.max(0, t - 0.08), x: pos.x, y: pos.y })
      keyframes.push({ t, x: pos.x, y: pos.y, click: true })
    } else {
      keyframes.push({ t: Math.max(0, t - 0.06), x: pos.x, y: pos.y })
      keyframes.push({ t, x: pos.x, y: pos.y })
    }

    lastT = t
    lastPos = pos
  }

  if (sortedActions.length > 0 && cursorPhases.length === 0) {
    for (const action of sortedActions) {
      const t = action.at ?? 0
      const pos = posForTarget(mode, action.target ?? 'main')
      if (action.type === 'hover') keyframes.push({ t, x: pos.x, y: pos.y, hover: true })
      else if (action.type === 'click') {
        keyframes.push({ t: Math.max(0, t - 0.08), x: pos.x, y: pos.y })
        keyframes.push({ t, x: pos.x, y: pos.y, click: true })
      } else if (action.type === 'type' || action.type === 'focus') {
        keyframes.push({ t, x: pos.x, y: pos.y })
      }
      lastT = t
      lastPos = pos
    }
  }

  const endT = Math.max(lastT + 0.5, timeline.payoffAt ?? 3.2, 2.8)
  keyframes.push({ t: endT, x: lastPos.x, y: lastPos.y })
  return keyframes
}

/**
 * Build a full demoScript from structured slide.actions (director DSL).
 */
export function buildDemoScriptFromActions(actions, mode, component, slide = {}) {
  const name = component?.name ?? ''
  const narration = `${slide.headline ?? ''} ${slide.narration ?? ''}`
  const sorted = [...actions].sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  const interactionPlan = normalizeInteractionPlan(slide.interactionPlan)
  const timeline = buildPhaseTimeline(interactionPlan, sorted)
  const registry = buildElementRegistry([], slide.demoScene)
  if (slide.elementRegistry?.length) {
    registry.list = slide.elementRegistry
    registry.byRef = new Map(slide.elementRegistry.map((e) => [e.ref, e]))
  }
  const demoBeats =
    slide.demoBeats?.length > 0
      ? normalizeDemoBeats(slide.demoBeats, registry)
      : interactionPlanToBeats(interactionPlan, registry)

  const demoText = demoTextFromActions(sorted, slide, name, narration)
  const isRedirect = /redirect/i.test(name) || narrationMentionsRedirect(narration)

  const openAt = timeline.openAt ?? 1.0
  const typeAt = timeline.typeAt ?? openAt + 0.5
  const expandAt = timeline.expandAt ?? 1.2
  const dropdownOpenAt = timeline.dropdownAt ?? typeAt + 0.85
  const submitAt = timeline.submitAt ?? null
  const payoffAt = timeline.payoffAt ?? (submitAt != null ? submitAt + 0.4 : null)
  const closeAt = submitAt
  const hoverAt = timeline.hoverAt ?? Math.max(0, openAt - 0.3)

  const keyframes =
    demoBeats.length >= 3
      ? buildCursorKeyframesFromBeats(demoBeats, registry)
      : buildCursorKeyframesFromTimeline(timeline, mode, sorted)

  const focusTarget =
    sorted.find((a) => a.type === 'type' || a.type === 'focus')?.target ??
    sorted.find((a) => a.type === 'click')?.target ??
    'main'

  const storyCamera = buildCameraFromPlan(interactionPlan, mode, posForTarget)
  const endT = keyframes[keyframes.length - 1]?.t ?? 3.2
  const camera = storyCamera ?? {
    keyframes: [
      { t: 0, target: 'main', scale: 1.0, padding: 44, phase: 'establish' },
      { t: Math.max(0, hoverAt), target: 'trigger', scale: 1.14, padding: 28, phase: 'isolate' },
      { t: openAt, target: 'trigger', scale: 1.18, padding: 28, phase: 'click' },
      { t: typeAt, target: focusTarget, scale: 1.2, padding: 28, phase: 'type' },
      { t: endT, target: focusTarget, scale: 1.12, padding: 32, phase: 'payoff' },
    ],
  }

  const base = {
    keyframes,
    camera,
    hoverAt,
    actions: sorted,
    demoText,
    redirectDemoText: isRedirect ? demoText : 'Holiday coverage',
    interactionPlan,
    storyBeat: slide.storyBeat ?? null,
    submitAt,
    payoffAt,
    phaseTimeline: timeline,
    expandAt,
    demoBeats,
    elementRegistry: registry.list,
  }

  if (mode === 'table' || /Table$/i.test(name)) {
    return { ...base, type: 'table', expandAt }
  }

  if (mode === 'modal' || /Modal$/i.test(name)) {
    return {
      ...base,
      type: 'modal',
      modalOpenAt: openAt,
      typeStartAt: typeAt,
      dropdownOpenAt,
      closeAt,
    }
  }

  if (mode === 'page') {
    const showRedirect =
      /redirect/i.test(name) ||
      (narrationMentionsRedirect(narration) && !narrationMentionsSchedule(narration))

    return {
      ...base,
      type: showRedirect ? 'page-redirect' : 'page-schedule',
      scheduleModalAt: showRedirect ? 999 : openAt,
      redirectModalAt: showRedirect ? openAt : 999,
      typeStartAt: typeAt,
      redirectTypeStartAt: typeAt,
      dropdownOpenAt,
    }
  }

  return { ...base, type: 'static' }
}

export function inferDemoScript(component, mode, narration = '', slide = {}) {
  if (slide.actions?.length) {
    return buildDemoScriptFromActions(slide.actions, mode, component, slide)
  }

  const plan = normalizeInteractionPlan(slide.interactionPlan)
  if (plan.length > 0) {
    const actions = interactionPlanToActions(plan, slide)
    return buildDemoScriptFromActions(actions, mode, component, slide)
  }

  const fallback = defaultActionsForKind(
    mode === 'page' ? 'page' : mode === 'table' ? 'table' : component?.kind ?? 'component',
    component?.name ?? '',
    narration,
  )
  return buildDemoScriptFromActions(fallback, mode, component, { ...slide, narration })
}

export function getDemoCursorPosition(demoScript, frame, fps) {
  const keyframes = demoScript?.keyframes
  if (!keyframes?.length) return null

  const t = frame / fps
  let i = 0
  while (i < keyframes.length - 1 && keyframes[i + 1].t <= t) i++

  const current = keyframes[Math.min(i, keyframes.length - 1)]
  if (i >= keyframes.length - 1) {
    return { x: current.x, y: current.y, click: false, clickProgress: 0, hover: Boolean(current.hover) }
  }

  const next = keyframes[i + 1]
  const span = next.t - current.t
  const progress = span > 0 ? Math.min(1, (t - current.t) / span) : 1
  const eased = progress * progress * (3 - 2 * progress)

  const clickWindow = next.click && progress > 0.82 && progress < 0.98
  const hoverWindow = (current.hover || next.hover) && progress < 0.95
  const clickProgress = next.click ? Math.min(1, Math.max(0, (progress - 0.82) / 0.16)) : 0

  return {
    x: current.x + (next.x - current.x) * eased,
    y: current.y + (next.y - current.y) * eased,
    click: clickWindow,
    clickProgress,
    hover: hoverWindow,
  }
}

export function getCameraTransform(demoScript, frame, fps, durationInFrames) {
  const t = frame / fps
  const registry = {
    list: demoScript?.elementRegistry ?? [],
    byRef: new Map((demoScript?.elementRegistry ?? []).map((e) => [e.ref, e])),
  }
  const beats = demoScript?.demoBeats?.length ? normalizeDemoBeats(demoScript.demoBeats, registry) : null

  if (beats?.length >= 2) {
    const beatState = deriveStateFromBeats(beats, t, frame, fps, registry)
    const scale = beatState.camera?.scale ?? 1.04
    const mode = demoScript?.type?.startsWith('page') ? 'page' : 'modal'
    const map = ROLE_LAYOUT[mode] ?? ROLE_LAYOUT.component
    const focusRole = beatState.focusTarget ?? 'main'
    const pos = map[focusRole] ?? map.main
    const focusX = pos.x
    const focusY = pos.y
    const panX = (50 - focusX) * 0.32 * (scale - 1)
    const panY = (50 - focusY) * 0.26 * (scale - 1)
    return { scale, panX, panY }
  }

  const camKeyframes = demoScript?.camera?.keyframes
  const mode = demoScript?.type === 'table' ? 'table' : demoScript?.type?.startsWith('page') ? 'page' : 'modal'
  const map = ROLE_LAYOUT[mode] ?? ROLE_LAYOUT.component

  if (!camKeyframes?.length) {
    return { scale: 1.04, panX: 0, panY: 0 }
  }

  let i = 0
  while (i < camKeyframes.length - 1 && camKeyframes[i + 1].t <= t) i++

  const current = camKeyframes[Math.min(i, camKeyframes.length - 1)]
  const next = camKeyframes[Math.min(i + 1, camKeyframes.length - 1)]

  const span = (next.t ?? 0) - (current.t ?? 0)
  const progress = span > 0 ? Math.min(1, (t - (current.t ?? 0)) / span) : 1
  const eased = progress * progress * (3 - 2 * progress)

  const curPos = map[current.target] ?? map.main
  const nextPos = map[next.target] ?? map.main
  const scale = (current.scale ?? 1.04) + ((next.scale ?? 1.04) - (current.scale ?? 1.04)) * eased

  const focusX = curPos.x + (nextPos.x - curPos.x) * eased
  const focusY = curPos.y + (nextPos.y - curPos.y) * eased
  const panX = (50 - focusX) * 0.32 * (scale - 1)
  const panY = (50 - focusY) * 0.26 * (scale - 1)

  const intro = interpolateClamped(frame, [0, fps * 0.35], [1.0, scale])
  const outroStart = durationInFrames - fps * 0.4
  const finalScale =
    frame > outroStart
      ? scale + interpolateClamped(frame, [outroStart, durationInFrames], [0, -0.04])
      : frame < fps * 0.35
        ? intro
        : scale

  return { scale: finalScale, panX, panY }
}

function interpolateClamped(frame, range, output) {
  const [a, b] = range
  const [oa, ob] = output
  if (frame <= a) return oa
  if (frame >= b) return ob
  const p = (frame - a) / (b - a)
  return oa + (ob - oa) * p
}

function firstOpenAt(demoScript) {
  return Math.min(
    demoScript.modalOpenAt ?? Infinity,
    demoScript.scheduleModalAt ?? Infinity,
    demoScript.redirectModalAt ?? Infinity,
  )
}

function computeRevealStep(demoScript, t) {
  const openAt = firstOpenAt(demoScript)
  if (openAt === Infinity || t < openAt) return -1

  const rel = t - openAt
  if (rel < 0.15) return 0

  const expandAt = demoScript.expandAt ?? demoScript.phaseTimeline?.expandAt ?? null
  const typeAt = demoScript.typeStartAt ?? demoScript.phaseTimeline?.typeAt ?? null
  const dropdownAt = demoScript.dropdownOpenAt ?? demoScript.phaseTimeline?.dropdownAt ?? null
  const submitAt = demoScript.submitAt ?? demoScript.phaseTimeline?.submitAt ?? demoScript.closeAt ?? null

  if (expandAt != null && t < expandAt) return 1
  if (typeAt != null && t < typeAt) return 1
  if (dropdownAt != null && t < dropdownAt) return 2
  if (submitAt != null && t < submitAt) return 2

  return 3
}

function entranceProgress(t, openAt, fps, frame) {
  if (openAt == null || t < openAt) return 0
  return interpolateClamped(frame, [openAt * fps, openAt * fps + fps * 0.35], [0, 1])
}

/**
 * Derive the full interactive demo state from the demoScript + current frame.
 * `frame` is demo-relative (0 = when the cursor/interaction sequence starts).
 * Remotion owns the timeline — components receive this as demoState props.
 */
export function deriveDemoState(demoScript, frame, fps) {
  if (!demoScript) return {}

  const t = frame / fps
  const registry = {
    list: demoScript.elementRegistry ?? [],
    byRef: new Map((demoScript.elementRegistry ?? []).map((e) => [e.ref, e])),
  }

  const beats = demoScript.demoBeats?.length
    ? normalizeDemoBeats(demoScript.demoBeats, registry)
    : null

  if (beats?.length >= 3) {
    const beatState = deriveStateFromBeats(beats, t, frame, fps, registry)
    return beatState
  }

  const timeline = demoScript.phaseTimeline ?? buildPhaseTimeline(demoScript.interactionPlan ?? [], demoScript.actions ?? [])

  const hoverAt = demoScript.hoverAt ?? timeline.hoverAt ?? null
  const modalOpenAt = demoScript.modalOpenAt ?? null
  const scheduleModalAt = demoScript.scheduleModalAt ?? null
  const redirectModalAt = demoScript.redirectModalAt ?? null
  const typeStartSec = demoScript.typeStartAt ?? timeline.typeAt ?? null
  const redirectTypeStartSec = demoScript.redirectTypeStartAt ?? typeStartSec
  const expandAt = demoScript.expandAt ?? timeline.expandAt ?? null
  const dropdownOpenAt = demoScript.dropdownOpenAt ?? timeline.dropdownAt ?? null
  const submitAt = demoScript.submitAt ?? timeline.submitAt ?? demoScript.closeAt ?? null
  const payoffAt = demoScript.payoffAt ?? timeline.payoffAt ?? null

  const anyOpenAt = firstOpenAt(demoScript)
  const closedAfterSubmit = submitAt != null && t >= submitAt + 0.12

  const open = modalOpenAt != null && t >= modalOpenAt && !closedAfterSubmit
  const scheduleOpen =
    scheduleModalAt != null && t >= scheduleModalAt && scheduleModalAt !== 999 && !closedAfterSubmit
  const redirectOpen =
    redirectModalAt != null && t >= redirectModalAt && redirectModalAt !== 999 && !closedAfterSubmit

  const storyPhase = storyPhaseAt(demoScript.interactionPlan, t)
  const highlightTarget = highlightTargetForTime(timeline, t)
  const focus = highlightTarget ?? storyPhase?.focusTarget ?? 'main'

  const rawHover =
    hoverAt != null && t >= hoverAt && t < (anyOpenAt === Infinity ? hoverAt + 0.5 : anyOpenAt)

  const demoHoverTrigger = rawHover && focus === 'trigger'

  const typedText =
    typeStartSec != null && !closedAfterSubmit
      ? (demoScript.demoText ?? '').slice(
          0,
          Math.floor(Math.max(0, frame - typeStartSec * fps) / (fps * 0.07)),
        )
      : closedAfterSubmit
        ? demoScript.demoText ?? ''
        : ''

  const hoverInput =
    redirectOpen &&
    redirectTypeStartSec != null &&
    t >= redirectTypeStartSec - 0.1 &&
    t < redirectTypeStartSec + 1.2 &&
    !closedAfterSubmit
      ? true
      : typeStartSec != null &&
          t >= typeStartSec - 0.1 &&
          t < typeStartSec + 1.2 &&
          !closedAfterSubmit

  const demoHoverSubmit =
    submitAt != null && t >= submitAt - 0.18 && t < submitAt + 0.08

  const redirectTypedText =
    redirectOpen && redirectTypeStartSec != null && !closedAfterSubmit
      ? (demoScript.redirectDemoText ?? '').slice(
          0,
          Math.floor(Math.max(0, frame - redirectTypeStartSec * fps) / (fps * 0.07)),
        )
      : closedAfterSubmit
        ? demoScript.redirectDemoText ?? ''
        : ''

  const expanded = expandAt != null && t >= expandAt
  const demoHoverExpand = hoverAt != null && expandAt != null && t >= hoverAt && t < expandAt

  const dropdownOpen =
    dropdownOpenAt != null && t >= dropdownOpenAt && (!submitAt || t < submitAt)
  const demoHoverDropdown =
    dropdownOpenAt != null && t >= dropdownOpenAt - 0.15 && t < dropdownOpenAt + 0.35

  const activeOpenAt =
    scheduleOpen && scheduleModalAt !== 999
      ? scheduleModalAt
      : redirectOpen && redirectModalAt !== 999
        ? redirectModalAt
        : modalOpenAt

  const modalEntrance = closedAfterSubmit
    ? 0
    : entranceProgress(t, activeOpenAt === Infinity ? null : activeOpenAt, fps, frame)

  const timeRevealStep = computeRevealStep(demoScript, t)
  const revealStep = revealStepForPhase(storyPhase, timeRevealStep)

  const anyOpen = scheduleOpen || redirectOpen || open
  const isolateSpotlight =
    storyPhase &&
    ['establish', 'isolate', 'hover'].includes(storyPhase.phase) &&
    !anyOpen

  const showPayoff =
    (payoffAt != null && t >= payoffAt) ||
    (submitAt != null && t >= submitAt + 0.2) ||
    (closedAfterSubmit && typedText.length > 0)

  return {
    open,
    scheduleOpen,
    redirectOpen,
    demoHoverTrigger,
    typedText,
    hoverInput,
    demoHoverSubmit,
    redirectTypedText,
    expanded,
    demoHoverExpand,
    dropdownOpen,
    demoHoverDropdown,
    modalEntrance,
    revealStep,
    storyPhase,
    isolateSpotlight,
    focusTarget: storyPhase?.focusTarget ?? 'main',
    highlightTarget,
    showPayoff,
    demoPhase: storyPhase?.phase ?? null,
  }
}

/** Map slide frame → demo-relative frame (after cursor intro). */
export function demoFrameFromSlide(frame, fps) {
  const cursorStart = Math.round(fps * DEMO_CURSOR_START_SEC)
  return Math.max(0, frame - cursorStart)
}

export function isHoverActive(demoScript, frame, fps) {
  const cursor = getDemoCursorPosition(demoScript, frame, fps)
  if (cursor?.hover) return true
  const hoverAt = demoScript?.hoverAt
  if (hoverAt == null) return false
  const t = frame / fps
  const openAt =
    demoScript.modalOpenAt ??
    demoScript.scheduleModalAt ??
    demoScript.redirectModalAt ??
    demoScript.expandAt ??
    hoverAt + 0.5
  return t >= hoverAt && t < openAt
}
