import { collectClosure } from './bundleForLive'
import { applyStubs } from './buildSandbox'
import { parseComponentExports } from './discoverComponents'
import { findDemoRoot, inferDemoScript } from './inferDemoScript'
import { patchClosureForDemo } from './patchForDemo'

function stripCssImports(source) {
  return source
    .replace(/^\s*import\s+['"][^'"]+\.css['"]\s*;?/gm, '')
    .replace(/^\s*import\s+['"][^'"]+\.(scss|sass|less)['"]\s*;?/gm, '')
}

function diskPath(repoPath) {
  return repoPath.replace(/^\//, '')
}

function findParentPageForModal(modalComponent, files, parseExports) {
  for (const [path, source] of files) {
    if (!/(pages|views)\//i.test(path)) continue
    if (!source.includes(modalComponent.name)) continue
    const exports = parseExports(source)
    const pageExp = exports.find((e) => /Page$/i.test(e.name))
    if (pageExp) return { path, name: pageExp.name, kind: pageExp.kind, source }
  }
  return null
}

/**
 * Infer mock prop values from a component's TypeScript source.
 * Returns an object mapping prop name → JSX attribute string value.
 */
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
    .map((p) => p.trim().split(/[?:=]/)[0].trim())
    .filter((k) => k && /^[a-zA-Z_$]/.test(k) && k !== 'demoState')

  for (const key of keys) {
    if (key.startsWith('on') || key.startsWith('handle')) {
      props[key] = '() => {}'
    } else if (/^(open|isOpen|visible|show)$/.test(key)) {
      props[key] = 'demoState.open ?? false'
    } else if (/^expanded$/.test(key)) {
      props[key] = 'demoState.expanded ?? false'
    } else if (/^(isThinking|loading|disabled|isPending)$/.test(key)) {
      props[key] = 'false'
    } else if (/^(hasMessages|hasItems)$/.test(key)) {
      props[key] = 'false'
    } else if (/messages|items|data|rows|options|schedules|redirects|list|teammates/i.test(key)) {
      props[key] = '[]'
    } else if (/^feedback$/.test(key)) {
      props[key] = 'null'
    } else if (/feedback|record/i.test(key)) {
      props[key] = '{}'
    } else if (/^message$/.test(key)) {
      props[key] = "{ id: 'demo-1', role: 'assistant', content: 'Here is how I can help with your calendar.' }"
    } else if (/autoFocus|autoPlay/.test(key)) {
      props[key] = 'false'
    }
    // Skip complex/unknown types — component handles undefined gracefully
  }

  return props
}

function formatMockProps(props) {
  return Object.entries(props)
    .map(([k, v]) => `\n        ${k}={${v}}`)
    .join('')
}

const DEMOSTATE_WRAPPER = `
export default function PRComponentPreview({ demoState = {} }) {
  const highlight = demoState.highlightTarget ?? '';
  const phase = demoState.demoPhase ?? '';
  const focusRef = demoState.focusRef ?? '';
  const hideRest = demoState.hideRest ? 'true' : 'false';
  const targetScale = demoState.targetScale ?? 1;
  const focusCss = focusRef
    ? \`#pr-preview-root[data-demo-focus-ref="\${focusRef}"] [data-demo-ref="\${focusRef}"] { opacity: 1 !important; filter: none !important; transform: scale(\${targetScale}); z-index: 40; position: relative; }\`
    : '';
  return (
    <>
      {focusCss ? <style dangerouslySetInnerHTML={{ __html: focusCss }} /> : null}
      <div
        className="min-h-screen p-4"
        style={{ minHeight: '100vh', background: '#101010', '--demo-target-scale': targetScale }}
        data-demo-highlight={highlight}
        data-demo-phase={phase}
        data-demo-focus-ref={focusRef}
        data-demo-hide-rest={hideRest}
        id="pr-preview-root"
      >
        SLOT
      </div>
    </>
  );
}`

/**
 * Generates a demoState-driven entry component. Props for the source component
 * are inferred from its TypeScript signature so the entry works regardless of
 * what mode (modal/component/table) the component was classified as.
 */
function buildEntrySource(root, mode, files, parseExports) {
  const relPath = `./${diskPath(root.path)}`
  const importLine =
    root.kind === 'default'
      ? `import ${root.name} from '${relPath}';`
      : `import { ${root.name} } from '${relPath}';`

  // Modal with a parent page: render the full page so the trigger + modal coexist
  if (mode === 'modal') {
    const parentPage = findParentPageForModal(root, files, parseExports)
    if (parentPage) {
      const pagePath = `./${diskPath(parentPage.path)}`
      const pageImport =
        parentPage.kind === 'default'
          ? `import ${parentPage.name} from '${pagePath}';`
          : `import { ${parentPage.name} } from '${pagePath}';`

      const slot = `<${parentPage.name} demoState={demoState} />`
      return `${pageImport}\n${DEMOSTATE_WRAPPER.replace('SLOT', slot)}\n`
    }
  }

  // All other cases: infer mock props from the component's own TypeScript source,
  // then pass them alongside demoState so the component renders without crashing.
  const rootSource = files.get(root.path) ?? files.get(`/${root.path}`) ?? ''
  const mockProps = inferMockProps(rootSource, root.name)
  const mockPropsStr = formatMockProps(mockProps)

  const slot = `<${root.name}${mockPropsStr}
          demoState={demoState} />`
  return `${importLine}\n${DEMOSTATE_WRAPPER.replace('SLOT', slot)}\n`
}

export function preparePrComponentFiles(files, component, slide = {}) {
  const resolved = applyStubs(files)
  const demoRoot = findDemoRoot(component, resolved, parseComponentExports, slide)
  const narration = `${slide.headline ?? ''} ${slide.narration ?? ''}`
  const demoScript = inferDemoScript(demoRoot.root, demoRoot.mode, narration, slide)

  const closure = collectClosure(resolved, demoRoot.root.path)
  const demoScene = slide.demoScene ?? null
  const patched = patchClosureForDemo(closure, demoRoot, demoScript, demoScene)

  const filesToWrite = {}
  for (const [path, source] of patched) {
    filesToWrite[diskPath(path)] = stripCssImports(source)
  }

  if (demoRoot.mode === 'modal') {
    const parentPage = findParentPageForModal(demoRoot.root, resolved, parseComponentExports)
    if (parentPage) {
      const pageClosure = collectClosure(resolved, parentPage.path)
      const pagePatched = patchClosureForDemo(
        pageClosure,
        { root: parentPage, mode: 'page' },
        demoScript,
        demoScene,
      )
      for (const [path, source] of pagePatched) {
        filesToWrite[diskPath(path)] = stripCssImports(source)
      }
    }
  }

  filesToWrite['entry.jsx'] = buildEntrySource(
    demoRoot.root,
    demoRoot.mode,
    resolved,
    parseComponentExports,
  )

  return { filesToWrite, demoScript }
}

export async function postPRComponents(slideId, files, component, slide = {}) {
  const { filesToWrite, demoScript } = preparePrComponentFiles(files, component, slide)

  const res = await fetch('/api/pr-components', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slideId, files: filesToWrite }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to write PR components: ${res.status} ${err}`)
  }

  await res.json()
  return { slideId, demoScript }
}

export async function finalizePrLiveRegistry() {
  const res = await fetch('/api/pr-live-registry', { method: 'POST' })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Failed to rebuild pr-live registry: ${res.status} ${err}`)
  }
  return res.json()
}
