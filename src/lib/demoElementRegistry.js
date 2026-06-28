/**
 * Stable element refs for the demo beat DSL.
 * Format: ComponentName@role:label-slug  OR  ComponentName#dom-id
 *
 * Agents MUST reference these refs in demoBeats — Remotion resolves them to
 * data-demo-ref attributes patched into source at build time.
 */

function slugify(label) {
  return (
    String(label ?? 'el')
      .toLowerCase()
      .replace(/\+/g, 'plus')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'el'
  )
}

export function makeElementRef(component, role, label, id) {
  const comp = String(component ?? 'Component').replace(/[^\w]/g, '')
  if (id) return `${comp}#${id}`
  return `${comp}@${role}:${slugify(label)}`
}

export function withRefs(elements, componentName) {
  if (!Array.isArray(elements)) return []
  const seen = new Set()
  return elements.map((el) => {
    const ref = makeElementRef(componentName, el.role, el.label, el.id)
    let unique = ref
    let n = 2
    while (seen.has(unique)) {
      unique = `${ref}~${n++}`
    }
    seen.add(unique)
    return { ...el, component: componentName, ref: unique }
  })
}

/**
 * Flat registry from catalog + demo scene components.
 */
export function buildElementRegistry(catalog = [], demoScene = null) {
  const byRef = new Map()
  const list = []

  const components =
    demoScene?.components?.map((c) => ({
      name: c.name,
      path: c.path,
      role: c.role,
      elements: c.elements ?? [],
    })) ??
    catalog.map((c) => ({
      name: c.name,
      path: c.path,
      role: c.kind,
      elements: c.elements ?? [],
    }))

  for (const comp of components) {
    const catalogMeta = catalog.find((c) => c.name === comp.name)
    const raw = catalogMeta?.elements ?? comp.elements
    for (const el of withRefs(raw, comp.name)) {
      const entry = {
        ref: el.ref,
        component: comp.name,
        path: comp.path ?? catalogMeta?.path,
        componentRole: comp.role,
        role: el.role,
        label: el.label,
        ...(el.id ? { id: el.id } : {}),
        ...(el.htmlFor ? { htmlFor: el.htmlFor } : {}),
      }
      byRef.set(el.ref, entry)
      list.push(entry)
    }
  }

  return { list, byRef, rootComponent: demoScene?.rootComponent ?? components[0]?.name }
}

export function resolveRef(ref, registry) {
  if (!ref || !registry?.byRef) return null
  return registry.byRef.get(ref) ?? null
}

export function formatRegistryForPrompt(registry) {
  if (!registry?.list?.length) return '(no elements — scan failed)'

  const lines = [
    'ELEMENT REGISTRY — use EXACT ref strings in demoBeats.targetRef / show / hide / reveal:',
    '',
  ]

  let lastComp = null
  for (const el of registry.list) {
    if (el.component !== lastComp) {
      lines.push(`[${el.component}] ${el.path ?? ''}`)
      lastComp = el.component
    }
    const bits = [`ref="${el.ref}"`, `role=${el.role}`, `label="${el.label}"`]
    if (el.id) bits.push(`id=${el.id}`)
    lines.push(`  · ${bits.join(' · ')}`)
  }

  return lines.join('\n')
}

export function matchRef(registry, { component, role, label, id } = {}) {
  if (!registry?.list?.length) return null
  if (id && component) {
    const byId = registry.list.find((e) => e.component === component && e.id === id)
    if (byId) return byId.ref
  }
  const normalized = String(label ?? '').toLowerCase()
  const hit = registry.list.find((e) => {
    if (component && e.component !== component) return false
    if (role && e.role !== role) return false
    if (normalized && !String(e.label ?? '').toLowerCase().includes(normalized)) return false
    return true
  })
  return hit?.ref ?? null
}
