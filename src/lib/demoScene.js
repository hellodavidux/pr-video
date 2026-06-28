import { withRefs } from './demoElementRegistry.js'

/**
 * Multi-component demo scene: Page → Modal → inputs/buttons.
 * Storytelling must reference concrete elements inside the React tree, not just the parent export.
 */

function inferKind(name) {
  if (/Modal$/i.test(name)) return 'modal'
  if (/Table$/i.test(name)) return 'table'
  if (/Page$/i.test(name)) return 'page'
  if (/Form$/i.test(name)) return 'form'
  if (/Button$/i.test(name)) return 'button'
  return 'component'
}

export function findParentPageForComponent(componentName, catalog) {
  if (!componentName || !catalog?.length) return null
  return (
    catalog.find(
      (c) => /Page$/i.test(c.name) && c.source?.includes(`<${componentName}`),
    ) ??
    catalog.find(
      (c) => /Page$/i.test(c.name) && c.source?.includes(componentName),
    ) ??
    null
  )
}

export function findChildModals(component, catalog) {
  if (!component?.source || !catalog?.length) return []
  return catalog.filter(
    (c) => /Modal$/i.test(c.name) && component.source.includes(c.name),
  )
}

function sceneComponentEntry(meta, role, elements) {
  return {
    name: meta.name,
    path: meta.path,
    kind: meta.kind ?? inferKind(meta.name),
    role,
    capabilities: meta.capabilities ?? [],
    elements: withRefs(elements ?? meta.elements ?? [], meta.name),
  }
}

/**
 * Aggregate interactive elements across the demo closure (page + modals, etc.).
 * renderMode: page | isolated | overlay | auto
 */
export function buildDemoScene(focusComponentName, catalog = [], { renderMode = 'auto' } = {}) {
  if (!focusComponentName || !catalog?.length) return null

  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))
  const focus = byName[focusComponentName]
  if (!focus) return null

  const mode =
    renderMode === 'auto'
      ? /Modal$/i.test(focus.name)
        ? 'overlay'
        : /Page$/i.test(focus.name)
          ? 'page'
          : 'isolated'
      : renderMode

  const components = []

  if (mode === 'overlay' || /Modal$/i.test(focus.name)) {
    const page =
      byName[focus.parentPages?.[0]] ??
      findParentPageForComponent(focus.name, catalog)
    if (page) {
      components.push(sceneComponentEntry(page, 'container', page.elements ?? []))
    }
    components.push(sceneComponentEntry(focus, 'overlay', focus.elements ?? []))
  } else if (mode === 'page' || /Page$/i.test(focus.name)) {
    components.push(sceneComponentEntry(focus, 'container', focus.elements ?? []))
    for (const modal of findChildModals(focus, catalog)) {
      components.push(sceneComponentEntry(modal, 'overlay', modal.elements ?? []))
    }
  } else {
    // isolated — render only the sub-component, no parent page chrome
    components.push(sceneComponentEntry(focus, 'focus', focus.elements ?? []))
  }

  const root = components[0]
  const flatElements = components.flatMap((c) =>
    (c.elements ?? []).map((e) => ({
      ...e,
      component: c.name,
      componentRole: c.role,
    })),
  )

  const rootMode =
    mode === 'page' || /Page$/i.test(root.name)
      ? 'page'
      : mode === 'overlay' || /Modal$/i.test(root.name)
        ? 'modal'
        : /Table$/i.test(root.name)
          ? 'table'
          : 'component'

  return {
    focusComponent: focus.name,
    renderMode: mode,
    rootComponent: root.name,
    rootPath: root.path,
    rootMode,
    components,
    elements: flatElements,
  }
}

export function formatDemoSceneForPrompt(scene) {
  if (!scene?.components?.length) return '(no demo scene — infer from catalog)'

  const lines = [
    `Render root: ${scene.rootComponent} (${scene.rootMode}${scene.renderMode ? `, mode=${scene.renderMode}` : ''})`,
    `Story focus: ${scene.focusComponent}`,
    '',
    'Interactive elements (ONLY reference these — include component + label in each phase):',
  ]

  for (const c of scene.components) {
    lines.push(`  [${c.name}] (${c.role})`)
    for (const e of c.elements ?? []) {
      const bits = [`ref="${e.ref ?? ''}"`, `role=${e.role}`, `label="${e.label}"`]
      if (e.id) bits.push(`id="${e.id}"`)
      if (e.htmlFor) bits.push(`htmlFor="${e.htmlFor}"`)
      lines.push(`    - ${bits.join(', ')}`)
    }
  }

  return lines.join('\n')
}

export function resolveRenderComponentName(slide, catalog = []) {
  const scene =
    slide.demoScene ??
    (slide.component ? buildDemoScene(slide.component, catalog) : null)
  return scene?.rootComponent ?? slide.component ?? null
}

export function matchElement(scene, { role, label, component } = {}) {
  if (!scene?.elements?.length) return null

  const normalizedLabel = String(label ?? '').toLowerCase().trim()
  const hits = scene.elements.filter((e) => {
    if (role && e.role !== role) return false
    if (component && e.component !== component) return false
    if (normalizedLabel && !String(e.label ?? '').toLowerCase().includes(normalizedLabel)) {
      return false
    }
    return true
  })

  return hits[0] ?? scene.elements.find((e) => role && e.role === role) ?? null
}

function elementFromSceneRef(scene, ref) {
  if (!ref || !scene?.elements?.length) return null
  return scene.elements.find((e) => e.ref === ref) ?? null
}

function phaseWithElement(phase, bound) {
  return {
    ...phase,
    focusTarget: bound.role,
    element: {
      ref: bound.ref,
      component: bound.component,
      role: bound.role,
      label: bound.label,
      ...(bound.id ? { id: bound.id } : {}),
      ...(bound.htmlFor ? { htmlFor: bound.htmlFor } : {}),
    },
    description:
      phase.description || `${phase.phase} → ${bound.component}.${bound.role} "${bound.label}"`,
  }
}

/**
 * Bind plan phases to scene elements.
 * When a phase has an explicit ref (element.ref or targetRef), only accept an exact
 * registry match — never fuzzy-rebind to a different control.
 */
export function bindInteractionPlanToScene(plan, scene, { strictRefs = true } = {}) {
  if (!scene?.elements?.length) return plan

  return plan.map((phase) => {
    const explicitRef = phase.element?.ref ?? phase.targetRef ?? null

    if (explicitRef) {
      const bound = elementFromSceneRef(scene, explicitRef)
      if (bound) return phaseWithElement(phase, bound)
      return phase
    }

    if (strictRefs && phase.element?.component && phase.element?.label) {
      const bound = matchElement(scene, {
        role: phase.element.role ?? phase.focusTarget ?? phase.target,
        component: phase.element.component,
        label: phase.element.label,
      })
      if (bound) return phaseWithElement(phase, bound)
      return phase
    }

    if (phase.element?.component && phase.element?.label) return phase

    const bound =
      matchElement(scene, {
        role: phase.focusTarget ?? phase.target,
        component: phase.element?.component,
        label: phase.element?.label ?? phase.description,
      }) ?? matchElement(scene, { role: phase.focusTarget ?? phase.target })

    if (!bound) return phase

    return phaseWithElement(phase, bound)
  })
}
