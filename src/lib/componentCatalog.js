import { discoverComponents } from './discoverComponents'
import { withRefs } from './demoElementRegistry.js'

function inferKind(name) {
  if (/Modal$/i.test(name)) return 'modal'
  if (/Table$/i.test(name)) return 'table'
  if (/Page$/i.test(name)) return 'page'
  if (/Form$/i.test(name)) return 'form'
  if (/Button$/i.test(name)) return 'button'
  return 'component'
}

function inferCapabilities(kind, source) {
  const caps = new Set()
  if (kind === 'modal' || /\b(open|isOpen|modalOpen)\b/i.test(source)) {
    caps.add('open')
    caps.add('close')
  }
  if (/<input|textarea/i.test(source)) caps.add('type')
  if (/<select/i.test(source)) caps.add('dropdown')
  if (/type=["']submit["']|onSave|onContinue|onSubmit/i.test(source)) caps.add('submit')
  if (/expandedId|setExpanded|ChevronDown|ChevronUp/i.test(source)) caps.add('expand')
  if (/selected|setSelected|aria-selected/i.test(source)) caps.add('select')
  if (caps.size === 0) caps.add('display')
  return [...caps]
}

function inferInputLabel(source, inputId) {
  if (!inputId) return null
  const labelRe = new RegExp(
    `<label[^>]*htmlFor=["']${inputId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>([\\s\\S]*?)<\\/label>`,
    'i',
  )
  const m = source.match(labelRe)
  if (!m) return null
  return m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim() || null
}

export function extractElementsFromSource(source) {
  const elements = []
  const seenRoles = new Set()

  for (const m of source.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi)) {
    const tag = m[0]
    const inner = m[1].replace(/<[^>]+>/g, ' ').trim()
    const aria = tag.match(/aria-label=["']([^"']+)["']/)?.[1]
    const id = tag.match(/\bid=["']([^"']+)["']/)?.[1]
    let label = (inner || aria || '').replace(/\s+/g, ' ').trim()
    if (!label || label.length > 48) continue

    if (/Plus/i.test(m[1]) && /\bnew\b/i.test(label)) label = '+ New'
    if (/UserPlus/i.test(m[1]) && /\binvite\b/i.test(label)) label = 'Invite'

    let role = 'button'
    if (/\+|^\s*new\s*$|add|create|invite/i.test(label)) role = 'trigger'
    else if (/save|continue|submit|confirm|done/i.test(label)) role = 'submit'

    if (seenRoles.has(role)) continue
    seenRoles.add(role)
    elements.push({ role, label, ...(id ? { id } : {}) })
  }

  for (const m of source.matchAll(/<input[^>]*>/gi)) {
    const tag = m[0]
    if (/type=["'](hidden|checkbox|radio|file)["']/i.test(tag)) continue
    if (seenRoles.has('input')) break

    const id = tag.match(/\bid=["']([^"']+)["']/)?.[1]
    const placeholder = tag.match(/placeholder=["']([^"']+)["']/)?.[1]
    const label = inferInputLabel(source, id) ?? placeholder ?? 'text field'
    seenRoles.add('input')
    elements.push({
      role: 'input',
      label,
      ...(id ? { id, htmlFor: id } : {}),
    })
  }

  for (const m of source.matchAll(/<textarea[^>]*>/gi)) {
    if (seenRoles.has('input')) break
    const tag = m[0]
    const id = tag.match(/\bid=["']([^"']+)["']/)?.[1]
    const placeholder = tag.match(/placeholder=["']([^"']+)["']/)?.[1]
    const label = inferInputLabel(source, id) ?? placeholder ?? 'text area'
    seenRoles.add('input')
    elements.push({
      role: 'input',
      label,
      ...(id ? { id, htmlFor: id } : {}),
    })
  }

  if (/<select/i.test(source) && !seenRoles.has('dropdown')) {
    const selectId = source.match(/<select[^>]*\bid=["']([^"']+)["']/)?.[1]
    const selectLabel = inferInputLabel(source, selectId) ?? 'dropdown'
    elements.push({
      role: 'dropdown',
      label: selectLabel,
      ...(selectId ? { id: selectId, htmlFor: selectId } : {}),
    })
    seenRoles.add('dropdown')
  }

  if (/expandedId|ChevronDown/i.test(source) && !seenRoles.has('expand')) {
    elements.push({ role: 'expand', label: 'expand row' })
    seenRoles.add('expand')
  }

  if (!seenRoles.has('main')) {
    elements.push({ role: 'main', label: 'component body' })
  }

  return elements.slice(0, 8)
}

/**
 * Build a UI catalog from repo UI sources. PR-changed paths are marked for focus.
 */
export function buildComponentCatalog(uiFiles, { changedPaths = null } = {}) {
  if (!uiFiles?.length) return []

  const changedSet = changedPaths
    ? new Set([...changedPaths].map((p) => p.replace(/^\//, '')))
    : new Set(uiFiles.filter((f) => f.status !== 'ui-scan').map((f) => f.filename))

  const files = new Map(uiFiles.map((f) => [`/${f.filename}`, f.source]))
  const components = discoverComponents(files)

  const catalog = components.map((c) => ({
    path: c.path,
    name: c.name,
    kind: inferKind(c.name),
    changedInPR: changedSet.has(c.path.replace(/^\//, '')),
    capabilities: inferCapabilities(inferKind(c.name), c.source),
    elements: withRefs(extractElementsFromSource(c.source), c.name),
    source: c.source,
  }))

  return enrichCatalogHierarchy(catalog)
}

function enrichCatalogHierarchy(catalog) {
  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))

  for (const c of catalog) {
    const parentPages = catalog.filter(
      (p) => /Page$/i.test(p.name) && p.source?.includes(`<${c.name}`),
    )
    const childComponents = catalog
      .filter((child) => child.name !== c.name && c.source?.includes(`<${child.name}`))
      .map((child) => child.name)

    c.parentPages = parentPages.map((p) => p.name)
    c.childComponents = childComponents.slice(0, 12)
  }

  return catalog
}

export function formatCatalogForPrompt(catalog) {
  if (!catalog?.length) return '(no UI components found — use generic demo language)'

  const sorted = [...catalog].sort((a, b) => {
    if (a.changedInPR !== b.changedInPR) return a.changedInPR ? -1 : 1
    const weight = (k) => ({ modal: 3, form: 2, table: 2, button: 1, page: 0, component: 0 }[k] ?? 0)
    return weight(b.kind) - weight(a.kind)
  })

  return sorted
    .map((c) => {
      const tags = [
        c.changedInPR ? '★ PR focus' : 'context',
        c.kind,
        c.capabilities.join('+'),
      ].join(', ')
      const hierarchy = [
        c.parentPages?.length ? `in ${c.parentPages.join(', ')}` : null,
        c.childComponents?.length ? `uses ${c.childComponents.slice(0, 5).join(', ')}` : null,
      ]
        .filter(Boolean)
        .join(' | ')
      const targets = c.elements
        .map((e) => {
          const bits = [`ref="${e.ref}"`, `${e.role}="${e.label}"`]
          if (e.id) bits.push(`#${e.id}`)
          return bits.join(' ')
        })
        .join(', ')
      const hierarchyLine = hierarchy ? `\n    hierarchy: ${hierarchy}` : ''
      return `- ${c.name} @ ${c.path} [${tags}]${hierarchyLine}\n    controls: ${targets}`
    })
    .join('\n')
}

export function catalogNames(catalog) {
  return [...new Set(catalog.map((c) => c.name))]
}

/** Pick a demo root component that actually exists in the scanned catalog. */
export function resolveDemoComponent(name, catalog = []) {
  if (!catalog?.length) return null

  const byName = Object.fromEntries(catalog.map((c) => [c.name, c]))
  if (name && byName[name]) return name

  const fuzzy =
    name &&
    catalog.find(
      (c) =>
        c.name.toLowerCase() === String(name).toLowerCase() ||
        c.path.toLowerCase().includes(String(name).toLowerCase()),
    )
  if (fuzzy) return fuzzy.name

  const changed = catalog.filter((c) => c.changedInPR)
  const pool = changed.length > 0 ? changed : catalog

  return (
    pool.find((c) => /Page$/i.test(c.name) && c.elements?.some((e) => e.role === 'trigger'))?.name ??
    pool.find((c) => /Page$/i.test(c.name))?.name ??
    pool.find((c) => /Table$/i.test(c.name))?.name ??
    pool.find((c) => /Modal$/i.test(c.name))?.name ??
    pool[0]?.name ??
    null
  )
}
