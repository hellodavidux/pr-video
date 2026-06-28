import { callLLM } from './llm.js'
import { collectClosure } from './bundleForLive'
import { finalizePrLiveRegistry, postPRComponents } from './buildRemotionEntry'

let _postPRComponents = postPRComponents
let _finalizePrLiveRegistry = finalizePrLiveRegistry

/** Override for node setup scripts (writes directly to disk instead of fetch). */
export function setPrLiveWriters({ postComponents, finalizeRegistry } = {}) {
  if (postComponents) _postPRComponents = postComponents
  if (finalizeRegistry) _finalizePrLiveRegistry = finalizeRegistry
}

export function resetPrLiveWriters() {
  _postPRComponents = postPRComponents
  _finalizePrLiveRegistry = finalizePrLiveRegistry
}
import { buildComponentCatalog } from './componentCatalog'
import { buildDemoScene, resolveRenderComponentName } from './demoScene.js'
import { discoverComponents, parseComponentExports } from './discoverComponents'
import { generateDemoActions, mergeDirectorResult } from './directorScript'
import { parseLLMJson } from './parseLLMJson.js'
import { parseProductTheme } from './productTheme'

const KNOWN_NPM = new Set([
  'react', 'react-dom', 'lucide-react', 'react-icons', 'framer-motion',
  'date-fns', 'dayjs', 'clsx', 'classnames', 'tailwind-merge',
  'react-router-dom', 'react-router', 'react-hook-form', 'zod',
  '@hookform/resolvers', '@tanstack/react-query', 'react-query', 'axios', 'swr',
  '@radix-ui/react-dialog', '@radix-ui/react-popover', '@radix-ui/react-slot',
  '@headlessui/react', '@heroicons/react',
])

const NEXT_STUBS = {
  'next/navigation': `export function useRouter() { return { push: () => {}, replace: () => {}, back: () => {}, prefetch: async () => {} }; }
export function usePathname() { return '/'; }
export function useSearchParams() { return new URLSearchParams(); }
export function useParams() { return {}; }
export function redirect() {}
export function notFound() {}`,
  'next/router': `export function useRouter() { return { push: () => {}, replace: () => {}, back: () => {}, pathname: '/', query: {}, asPath: '/' }; }
export default function Link({ children, href, ...p }) { return <a href={href ?? '#'} {...p}>{children}</a>; }`,
  'next/link': `export default function Link({ children, href, ...p }) { return <a href={href ?? '#'} {...p}>{children}</a>; }`,
  'next/image': `export default function Image(props) { return <img alt="" {...props} style={{ maxWidth: '100%', ...(props.style ?? {}) }} />; }`,
}

// ─── Export parsing ───────────────────────────────────────────────────────────

export { discoverComponents, parseComponentExports } from './discoverComponents'

// ─── Mock props ───────────────────────────────────────────────────────────────

function inferMockProps(source, componentName) {
  const props = {}

  const typeMatch = source.match(
    new RegExp(`type\\s+${componentName}Props\\s*=\\s*\\{([^}]+)\\}`, 's'),
  )
  const destructureMatch = source.match(
    new RegExp(`(?:export\\s+)?(?:async\\s+)?function\\s+${componentName}\\s*\\(\\s*\\{([^}]+)\\}`, 's'),
  )

  const raw = typeMatch?.[1] ?? destructureMatch?.[1] ?? ''
  if (!raw) return props

  const keys = raw
    .split(',')
    .map((p) => p.trim().split(':')[0].split('?')[0].split('=')[0].trim())
    .filter(Boolean)

  for (const key of keys) {
    if (key.startsWith('on') || key.startsWith('handle')) {
      props[key] = '() => {}'
    } else if (key === 'open' || key === 'isOpen' || key === 'visible' || key === 'show') {
      props[key] = 'true'
    } else if (/teammates|items|data|rows|options|schedules|redirects|list/i.test(key)) {
      props[key] = '[]'
    } else if (/children/.test(key)) {
      props[key] = 'undefined'
    } else if (/className|style/.test(key)) {
      props[key] = 'undefined'
    } else {
      props[key] = 'undefined'
    }
  }

  return props
}

function formatProps(props) {
  const entries = Object.entries(props)
  if (entries.length === 0) return ''
  const inner = entries.map(([k, v]) => `${k}={${v}}`).join(' ')
  return ` ${inner}`
}

// ─── CSS from repo theme ──────────────────────────────────────────────────────

import { buildStylesheet, buildTailwindConfig, buildStylesheetFromConfig } from './previewStyles.js'
export { buildStylesheet, buildTailwindConfig, buildStylesheetFromConfig } from './previewStyles.js'

// ─── Import stubs for unresolvable packages ───────────────────────────────────

function isNpmPackage(importPath) {
  if (importPath.startsWith('.') || importPath.startsWith('/')) return false
  return importPath.startsWith('@')
    ? importPath.split('/').slice(0, 2).join('/')
    : importPath.split('/')[0]
}

function isKnownNpm(pkg) {
  if (KNOWN_NPM.has(pkg)) return true
  if (pkg.startsWith('@radix-ui/')) return true
  if (pkg.startsWith('@heroicons/')) return true
  return false
}

function collectImports(source) {
  const imports = []
  const re = /import\s+(?:type\s+)?(?:(\*\s+as\s+\w+)|(?:\{([^}]+)\})|(\w+))\s+from\s+['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(source)) !== null) {
    const symbols = m[2]
      ? m[2].split(',').map((s) => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)
      : m[3]
        ? [m[3]]
        : []
    imports.push({ module: m[4], symbols, isTypeOnly: m[0].includes('import type') })
  }
  return imports
}

function stubPathForModule(moduleName) {
  const safe = moduleName.replace(/[@/]/g, '_')
  return `/src/__stubs__/${safe}.tsx`
}

function buildStubSource(moduleName, symbols) {
  if (NEXT_STUBS[moduleName]) return NEXT_STUBS[moduleName]

  const lines = symbols.map((sym) => {
    if (/^use[A-Z]/.test(sym)) {
      return `export function ${sym}() { return {}; }`
    }
    return `export const ${sym} = ({ children, ...props }) => (
  <div style={{ padding: 8, borderRadius: 8, border: '1px solid #333', color: '#fafafa' }} {...props}>{children ?? '${sym}'}</div>
);`
  })

  if (lines.length === 0) {
    lines.push(`const Stub = ({ children, ...props }) => <div {...props}>{children}</div>;`)
    lines.push('export default Stub;')
  }

  return lines.join('\n')
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function applyStubs(files) {
  const next = new Map(files)
  const stubFiles = new Map()
  const stubTargets = new Map()

  for (const source of files.values()) {
    for (const imp of collectImports(source)) {
      if (imp.isTypeOnly) continue
      const pkg = isNpmPackage(imp.module)
      if (!pkg || isKnownNpm(pkg)) continue
      stubTargets.set(imp.module, { symbols: imp.symbols, pkg })
    }
  }

  for (const [moduleName, { symbols }] of stubTargets) {
    const stubPath = stubPathForModule(moduleName)
    if (!stubFiles.has(stubPath)) {
      stubFiles.set(stubPath, buildStubSource(moduleName, symbols))
    }
  }

  for (const [path, source] of next) {
    let updated = source
    const fromDir = path.replace(/^\//, '')
    const fileDir = fromDir.includes('/') ? fromDir.slice(0, fromDir.lastIndexOf('/')) : ''

    for (const moduleName of stubTargets.keys()) {
      const stubPath = stubPathForModule(moduleName)
      const rel = computeRelative(fileDir, stubPath.replace(/^\//, ''))
      updated = updated.replace(
        new RegExp(`from\\s+['"]${escapeRegex(moduleName)}['"]`, 'g'),
        `from '${rel}'`,
      )
    }
    next.set(path, updated)
  }

  for (const [path, source] of stubFiles) next.set(path, source)
  return next
}

function computeRelative(fromDir, toPath) {
  const from = fromDir ? fromDir.split('/') : []
  const to = toPath.split('/')
  let i = 0
  while (i < from.length && i < to.length && from[i] === to[i]) i++
  const rel = [...Array(from.length - i).fill('..'), ...to.slice(i)].join('/')
  return rel.startsWith('.') ? rel : `./${rel}`
}

// ─── Slide ↔ component matching ─────────────────────────────────────────────────

function enrichComponents(components) {
  const catalog = buildComponentCatalog(
    components.map((c) => ({ filename: c.path.replace(/^\//, ''), source: c.source })),
  )
  const metaByPath = Object.fromEntries(catalog.map((c) => [c.path, c]))

  return components.map((c) => ({
    ...c,
    kind: metaByPath[c.path]?.kind ?? 'component',
    capabilities: metaByPath[c.path]?.capabilities ?? [],
    elements: metaByPath[c.path]?.elements ?? [],
  }))
}

function pickByHint(slide, components, used) {
  const renderName = resolveRenderComponentName(slide)
  const hints = [renderName, slide.component, slide.focusComponent].filter(Boolean)

  for (const hint of hints) {
    const lower = hint.toLowerCase()
    const match = components.find(
      (c) =>
        !used.has(c.path) &&
        (c.name.toLowerCase() === lower ||
          c.path.toLowerCase().includes(lower) ||
          c.name.toLowerCase().includes(lower)),
    )
    if (match) return match
  }
  return null
}

function storyNeedsPage(slide) {
  const text = `${slide.headline} ${slide.narration ?? ''} ${JSON.stringify(slide.interactionPlan ?? [])}`.toLowerCase()
  return (
    /\btrigger\b/.test(text) ||
    /\+ new|click.*new|open modal|create.*schedule|add.*redirect/.test(text) ||
    slide.interactionPlan?.some((p) => p.focusTarget === 'trigger' || p.phase === 'click')
  )
}

function componentWeight(c, slide) {
  let weight = 0
  if (/Modal$/i.test(c.name)) weight += 2
  else if (/Table$/i.test(c.name)) weight += 3
  else if (/Page$/i.test(c.name)) weight += storyNeedsPage(slide) ? 6 : -1
  return weight
}

function keywordMatch(slides, components) {
  const used = new Set()

  return slides.map((slide) => {
    const hinted = pickByHint(slide, components, used)
    if (hinted) {
      used.add(hinted.path)
      return { slideId: slide.id, component: hinted }
    }

    const text = `${slide.headline} ${slide.narration ?? ''} ${slide.component ?? ''}`.toLowerCase()

    const scored = components
      .map((c) => {
        const name = c.name.replace(/([A-Z])/g, ' $1').toLowerCase()
        const path = c.path.toLowerCase()
        let score = componentWeight(c, slide)
        if (slide.component && c.name === slide.component) score += 20
        for (const token of name.split(/\s+/)) {
          if (token.length > 2 && text.includes(token)) score += 3
        }
        for (const token of path.split(/[/._-]/)) {
          if (token.length > 3 && text.includes(token)) score += 2
        }
        if (used.has(c.path)) score -= 1
        return { component: c, score }
      })
      .sort((a, b) => b.score - a.score)

    const pick = scored[0]?.component ?? components[0]
    if (pick) used.add(pick.path)
    return { slideId: slide.id, component: pick }
  })
}

async function llmMatch(slides, components) {
  const componentList = components
    .map((c) => `- ${c.path} → ${c.name} (${c.kind} export)`)
    .join('\n')

  const slideList = slides
    .map(
      (s) =>
        `- id="${s.id}" headline="${s.headline}" narration="${s.narration ?? ''}"${s.component ? ` component="${s.component}"` : ''}${s.demoScene?.rootComponent ? ` renderRoot="${s.demoScene.rootComponent}"` : ''}`,
    )
    .join('\n')

  const text = await callLLM({
    system: `Match each video demo slide to the React component that can render the FULL story.
For create flows (click + New → modal → type → submit): pick the Page that contains the trigger AND mounts the modal — NOT the modal alone.
For table expand stories: pick the Table.
Honor slide.component and demoScene.rootComponent when provided.
Return ONLY valid JSON.`,
    user: `COMPONENTS:\n${componentList}\n\nSLIDES:\n${slideList}\n\nReturn: { "matches": [{ "slideId": "s1", "componentPath": "/src/pages/AvailabilityPage.tsx" }] }`,
    maxTokens: 800,
  })

  const result = parseLLMJson(text, 'Component matcher')
  const byPath = Object.fromEntries(components.map((c) => [c.path, c]))

  return result.matches.map((m) => ({
    slideId: m.slideId,
    component: byPath[m.componentPath] ?? components[0],
  }))
}

async function matchSlidesToComponents(slides, components) {
  if (components.length === 0) return slides.map((s) => ({ slideId: s.id, component: null }))

  const key = import.meta.env.VITE_ANTHROPIC_KEY
  if (key) {
    try {
      return await llmMatch(slides, components)
    } catch (e) {
      console.warn('[buildSandbox] LLM match failed, using keywords:', e.message)
    }
  }

  return keywordMatch(slides, components)
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function buildSlideSandboxes(bundle, script) {
  const { files, css } = bundle
  if (files.size === 0) {
    console.warn('[buildSandbox] No source files — skipping preview')
    return script
  }

  const components = enrichComponents(discoverComponents(files))
  console.log('[buildSandbox] Components found:', components.map((c) => `${c.name}@${c.path}`))

  if (components.length === 0) {
    console.warn('[buildSandbox] No React components discovered')
    return script
  }

  const demoSlides = script.slides.filter((s) => s.type === 'demo' || s.role === 'demo')
  const catalogForMatch = buildComponentCatalog(
    components.map((c) => ({ filename: c.path.replace(/^\//, ''), source: c.source })),
  )
  const slidesForMatch = demoSlides.map((slide) => ({
    ...slide,
    demoScene: slide.demoScene ?? buildDemoScene(slide.component, catalogForMatch, {
      renderMode: slide.renderMode ?? 'auto',
    }),
  }))
  const matches = await matchSlidesToComponents(slidesForMatch, components)
  const matchMap = Object.fromEntries(matches.map((m) => [m.slideId, m.component]))
  const heroComponent = matches.find((m) => m.component)?.component ?? components[0]
  const styles = buildStylesheet(css?.source)
  const tailwindConfig = buildTailwindConfig(css?.source)
  const resolvedFiles = applyStubs(files)

  async function attachPreview(slide, component, slideId) {
    const closureMap = collectClosure(resolvedFiles, component.path)
    console.log(
      '[buildSandbox] Slide',
      slideId,
      '→',
      component.name,
      component.path,
      `(${closureMap.size} files)`,
    )

    const directorResult =
      slide.role === 'demo'
        ? await generateDemoActions(slide, component, { catalog: catalogForMatch })
        : null
    const directedSlide = directorResult
      ? mergeDirectorResult({ ...slide, demoScene: slide.demoScene ?? buildDemoScene(slide.component, catalogForMatch) }, directorResult)
      : slide

    const { demoScript } = await _postPRComponents(slideId, resolvedFiles, component, directedSlide)
    return {
      ...directedSlide,
      component: { name: component.name, path: component.path },
      preview: {
        slideId,
        styles,
        tailwindConfig,
        ...(demoScript ? { demoScript } : {}),
      },
    }
  }

  const preparedSlides = await Promise.all(
    script.slides.map(async (slide) => {
        if (slide.role === 'hero' && heroComponent) {
          try {
            return await attachPreview(slide, heroComponent, slide.id)
          } catch (e) {
            console.warn('[buildSandbox] Failed to write hero preview:', e.message)
            return slide
          }
        }

        if (slide.type !== 'demo' && slide.role !== 'demo') return slide

        const component = matchMap[slide.id]
        if (!component) return slide

        try {
          return await attachPreview(slide, component, slide.id)
        } catch (e) {
          console.warn('[buildSandbox] Failed to write Remotion entry for', slide.id, e.message)
          return slide
        }
    }),
  )

  const previewSlideIds = preparedSlides
    .map((slide) => slide.preview?.slideId)
    .filter(Boolean)

  if (previewSlideIds.length === 0) {
    return {
      ...script,
      theme: parseProductTheme(css?.source, { brand: script.brand, repo: script.pr?.repo }),
      slides: preparedSlides,
    }
  }

  const { version: registryVersion } = await _finalizePrLiveRegistry()

  return {
    ...script,
    prLiveRegistryVersion: registryVersion,
    theme: parseProductTheme(css?.source, { brand: script.brand, repo: script.pr?.repo }),
    slides: preparedSlides.map((slide) =>
      slide.preview?.slideId
        ? { ...slide, preview: { ...slide.preview, registryVersion } }
        : slide,
    ),
  }
}
