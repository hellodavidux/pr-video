/**
 * Layout-aware cursor / camera / spotlight positions from element role + render mode.
 * Replaces scattered hardcoded maps across inferDemoScript and demoBeatSchema.
 */

const ROLE_LAYOUT = {
  page: {
    trigger: { x: 84, y: 11 },
    input: { x: 42, y: 50 },
    submit: { x: 52, y: 78 },
    expand: { x: 90, y: 38 },
    dropdown: { x: 42, y: 62 },
    row: { x: 50, y: 38 },
    main: { x: 52, y: 32 },
    button: { x: 78, y: 14 },
  },
  modal: {
    trigger: { x: 50, y: 82 },
    input: { x: 42, y: 46 },
    submit: { x: 52, y: 80 },
    dropdown: { x: 42, y: 58 },
    main: { x: 50, y: 48 },
    button: { x: 72, y: 80 },
  },
  table: {
    trigger: { x: 84, y: 12 },
    expand: { x: 92, y: 38 },
    row: { x: 50, y: 38 },
    main: { x: 50, y: 45 },
    input: { x: 42, y: 48 },
    submit: { x: 50, y: 70 },
  },
  component: {
    trigger: { x: 72, y: 18 },
    input: { x: 45, y: 50 },
    submit: { x: 50, y: 72 },
    dropdown: { x: 45, y: 62 },
    main: { x: 50, y: 45 },
    button: { x: 70, y: 22 },
  },
}

function inferModeFromContext({ demoScript, renderMode, rootMode, componentName } = {}) {
  if (renderMode === 'overlay' || /Modal$/i.test(componentName ?? '')) return 'modal'
  if (renderMode === 'page' || rootMode === 'page' || /Page$/i.test(componentName ?? '')) return 'page'
  if (rootMode === 'table' || /Table$/i.test(componentName ?? '')) return 'table'
  if (demoScript?.type === 'table') return 'table'
  if (demoScript?.type?.startsWith('page')) return 'page'
  if (demoScript?.type === 'modal') return 'modal'
  return 'component'
}

function adjustFromSource(pos, role, source = '') {
  if (!source) return pos

  let { x, y } = pos

  if (role === 'trigger') {
    if (/\bml-auto\b|\bjustify-end\b|\bright-\d|\bfixed\b.*\bright/i.test(source)) x = Math.max(x, 82)
    if (/\btop-0\b|\bheader\b|\bsticky\b/i.test(source)) y = Math.min(y, 14)
    if (/\bbottom-\d|\bfixed\b.*\bbottom/i.test(source)) y = Math.max(y, 82)
  }

  if (role === 'input' || role === 'dropdown') {
    if (/\bmax-w-(sm|md|lg|xl|2xl)\b/i.test(source)) y = Math.max(y, 44)
    if (/\bgrid-cols-2\b/i.test(source)) x = role === 'dropdown' ? 68 : x
  }

  if (role === 'submit' && /\bjustify-end\b|\bml-auto\b/i.test(source)) x = Math.max(x, 58)

  return { x, y }
}

export function posForRole(role, context = {}) {
  const mode = inferModeFromContext(context)
  const map = ROLE_LAYOUT[mode] ?? ROLE_LAYOUT.component
  const base = map[role] ?? map.main ?? { x: 50, y: 45 }
  return adjustFromSource(base, role, context.source)
}

export function posForElement(el, context = {}) {
  if (!el) return posForRole('main', context)
  return posForRole(el.role ?? 'main', {
    ...context,
    source: context.sourceByComponent?.[el.component] ?? context.source,
  })
}

export function posForTarget(mode, target) {
  return posForRole(target, { rootMode: mode, demoScript: { type: mode } })
}

export function cameraPanForFocus(focusX, focusY, scale) {
  return {
    panX: (50 - focusX) * 0.34 * Math.max(0, scale - 1),
    panY: (50 - focusY) * 0.28 * Math.max(0, scale - 1),
  }
}

export { inferModeFromContext, ROLE_LAYOUT }
