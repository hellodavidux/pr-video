/**
 * Generic validation for story-director demoBeats against element registry + scene.
 */

const FOCUS_CHAIN = ['isolate', 'hover', 'click']
const OVERLAY_BEATS = new Set(['reveal', 'type', 'select', 'submit'])

function overlayComponentNames(scene) {
  return new Set(
    (scene?.components ?? []).filter((c) => c.role === 'overlay').map((c) => c.name),
  )
}

function rootComponentName(scene) {
  return scene?.rootComponent ?? null
}

function resolveEl(registry, ref) {
  return ref ? registry?.byRef?.get(ref) ?? null : null
}

/**
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateDemoBeats(beats, registry, scene, meta = {}) {
  const errors = []

  if (!Array.isArray(beats) || beats.length === 0) {
    return { ok: false, errors: ['demoBeats is empty'] }
  }

  if (beats.length < 4) {
    errors.push(`demoBeats has only ${beats.length} beat(s) — need at least 4`)
  }

  const root = rootComponentName(scene)
  const overlays = overlayComponentNames(scene)
  const hasOverlay = overlays.size > 0
  const hasTrigger = registry.list.some((e) => e.role === 'trigger')
  const hasExpand = registry.list.some((e) => e.role === 'expand')
  const caps = new Set(meta?.capabilities ?? [])

  const allRefs = (b) => [
    b.targetRef,
    ...(b.show ?? []),
    ...(b.hide ?? []),
    ...(b.reveal ?? []),
  ].filter(Boolean)

  for (const b of beats) {
    for (const ref of allRefs(b)) {
      if (!registry.byRef.has(ref)) {
        errors.push(`Beat "${b.beat}" @ ${b.at}s: unknown ref "${ref}" (not in registry)`)
      }
    }
    if (!b.targetRef && !['establish', 'payoff'].includes(b.beat)) {
      errors.push(`Beat "${b.beat}" @ ${b.at}s: missing targetRef`)
    }
  }

  const establish = beats.find((b) => b.beat === 'establish')
  if (establish) {
    const el = resolveEl(registry, establish.targetRef)
    if (!establish.targetRef) {
      errors.push('establish beat requires targetRef (role=main on render root)')
    } else if (el) {
      if (el.role !== 'main') {
        errors.push(`establish must target role=main, got role=${el.role} (${establish.targetRef})`)
      }
      if (root && el.component !== root) {
        errors.push(
          `establish must target render root "${root}", got "${el.component}" (${establish.targetRef})`,
        )
      }
    }
  } else {
    errors.push('demoBeats must include an establish beat')
  }

  const chainBeats = beats.filter((b) => FOCUS_CHAIN.includes(b.beat))
  const chainRefs = [...new Set(chainBeats.map((b) => b.targetRef).filter(Boolean))]
  if (chainRefs.length > 1) {
    errors.push(`isolate, hover, and click must share one targetRef — got: ${chainRefs.join(', ')}`)
  }

  const clickBeat = beats.find((b) => b.beat === 'click')
  if (clickBeat?.targetRef) {
    const el = resolveEl(registry, clickBeat.targetRef)
    if (el) {
      if (el.role === 'button') {
        errors.push(
          `click must not target role=button (secondary chrome) — use role=trigger or role=expand (${clickBeat.targetRef})`,
        )
      }
      if (hasTrigger && el.role !== 'trigger' && el.role !== 'expand') {
        errors.push(
          `click should target role=trigger when the registry has one (${clickBeat.targetRef} is role=${el.role})`,
        )
      }
      if (!hasTrigger && hasExpand && el.role !== 'expand') {
        errors.push(`click should target role=expand for table expand flows (${clickBeat.targetRef})`)
      }
    }
  }

  if (hasOverlay) {
    for (const b of beats) {
      if (!OVERLAY_BEATS.has(b.beat) || !b.targetRef) continue
      const el = resolveEl(registry, b.targetRef)
      if (el && !overlays.has(el.component)) {
        errors.push(
          `${b.beat} should target an overlay component element (modal/form), not "${el.component}" (${b.targetRef})`,
        )
      }
    }
  }

  const typeBeat = beats.find((b) => b.beat === 'type')
  if (typeBeat && !typeBeat.demoText) {
    errors.push('type beat requires demoText')
  }

  if (hasOverlay && registry.list.some((e) => e.role === 'input') && !typeBeat) {
    const hasTrigger = registry.list.some((e) => e.role === 'trigger')
    if (hasTrigger && beats.some((b) => b.beat === 'click')) {
      errors.push('create flow with overlay input should include a type beat')
    }
  }

  for (let i = 1; i < beats.length; i++) {
    if (beats[i].at < beats[i - 1].at) {
      errors.push(
        `beat times must be non-decreasing: ${beats[i - 1].beat}@${beats[i - 1].at} then ${beats[i].beat}@${beats[i].at}`,
      )
      break
    }
  }

  return { ok: errors.length === 0, errors }
}

function findRegistryEl(registry, scene, { role, onRoot = false, onOverlay = false }) {
  const root = rootComponentName(scene)
  const overlays = overlayComponentNames(scene)

  return (
    registry.list.find((e) => {
      if (role && e.role !== role) return false
      if (onRoot && root && e.component !== root) return false
      if (onOverlay && !overlays.has(e.component)) return false
      return true
    }) ?? null
  )
}

/**
 * Build a capability-driven example timeline using only refs from this registry.
 */
export function buildExampleFlowFromRegistry(registry, scene, meta = {}) {
  const lines = []
  let t = 0
  const step = (text) => {
    lines.push(`${lines.length + 1}. ${text}`)
  }

  const main =
    findRegistryEl(registry, scene, { role: 'main', onRoot: true }) ??
    findRegistryEl(registry, scene, { role: 'main' })
  const trigger =
    findRegistryEl(registry, scene, { role: 'trigger', onRoot: true }) ??
    findRegistryEl(registry, scene, { role: 'trigger' })
  const expand = findRegistryEl(registry, scene, { role: 'expand' })
  const input =
    findRegistryEl(registry, scene, { role: 'input', onOverlay: true }) ??
    findRegistryEl(registry, scene, { role: 'input' })
  const dropdown =
    findRegistryEl(registry, scene, { role: 'dropdown', onOverlay: true }) ??
    findRegistryEl(registry, scene, { role: 'dropdown' })
  const submit =
    findRegistryEl(registry, scene, { role: 'submit', onOverlay: true }) ??
    findRegistryEl(registry, scene, { role: 'submit' })

  const action = trigger ?? expand

  if (main) {
    step(`establish @ ${t.toFixed(2)} — targetRef ${main.ref} (wide shot, role=main)`)
    t += 0.35
  }

  if (action) {
    step(
      `isolate @ ${t.toFixed(2)} — targetRef ${action.ref}, hideRest true, show=[${action.ref}]`,
    )
    t += 0.3
    step(`hover @ ${t.toFixed(2)} — same targetRef ${action.ref}`)
    t += 0.35
    step(`click @ ${t.toFixed(2)} — same targetRef ${action.ref}`)
    t += 0.15
  }

  if (input && action) {
    step(`reveal @ ${t.toFixed(2)} — targetRef ${input.ref} (overlay input, not page chrome)`)
    t += 0.45
    step(`type @ ${t.toFixed(2)} — targetRef ${input.ref}, demoText "<short label>"`)
    t += 0.9
  } else if (expand && !trigger) {
    step(`expand @ ${t.toFixed(2)} — targetRef ${expand.ref}`)
    t += 0.5
  }

  if (dropdown) {
    step(`select @ ${t.toFixed(2)} — targetRef ${dropdown.ref}`)
    t += 0.6
  }

  if (submit) {
    step(`submit @ ${t.toFixed(2)} — targetRef ${submit.ref}`)
    t += 0.6
  }

  if (main) {
    step(`payoff @ ${t.toFixed(2)} — targetRef ${main.ref}`)
  }

  if (lines.length === 0) {
    return '(use EXACT refs from ELEMENT REGISTRY above — one beat per interactive step)'
  }

  const root = rootComponentName(scene) ?? 'root'
  return `Suggested flow for ${root} (copy refs verbatim, adjust timings only):\n${lines.join('\n')}`
}
