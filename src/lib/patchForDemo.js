/**
 * Patches fetched PR source so component state is driven by demoState props
 * passed down from Remotion (PRSlide → GeneratedPreview → component).
 * No component file imports useCurrentFrame — Remotion owns the timeline.
 */

import { patchGenericDemoSource } from './patchGenericDemo.js'

const HOVER_RING =
  'ring-2 ring-indigo-400/80 ring-offset-2 ring-offset-cal-bg shadow-lg shadow-indigo-500/20'

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function labelNeedles(label) {
  const base = String(label ?? '').trim()
  const out = new Set([base])
  if (base.startsWith('+ ')) out.add(base.slice(2))
  if (/\bnew\b/i.test(base)) out.add('New')
  return [...out].filter(Boolean)
}

export function injectDemoTargets(source, elements = []) {
  if (!source) return source

  let s = source
  for (const el of elements) {
    if (!el?.role || el.role === 'main') continue
    const target = el.role

    if (el.ref) {
      if (el.id && (target === 'input' || target === 'dropdown')) {
        const idRe = new RegExp(
          `(<(?:input|select|textarea)[^>]*\\bid=["']${escapeRegex(el.id)}["'][^>]*)(/?>)`,
          'i',
        )
        s = s.replace(idRe, (match, head, tail) => {
          if (head.includes('data-demo-ref')) return match
          return `${head} data-demo-ref="${el.ref}" data-demo-target="${target}"${tail}`
        })
      }

      for (const needle of labelNeedles(el.label)) {
        const re = new RegExp(
          `(<button[^>]*>[\\s\\S]*?${escapeRegex(needle)}[\\s\\S]*?<\\/button>)`,
          'i',
        )
        s = s.replace(re, (match) => {
          if (match.includes('data-demo-ref')) return match
          return match.replace('<button', `<button data-demo-ref="${el.ref}" data-demo-target="${target}"`)
        })
      }

      if (target === 'input' && el.id) continue
    }

    if (el.id && (target === 'input' || target === 'dropdown')) {
      const idRe = new RegExp(
        `(<(?:input|select|textarea)[^>]*\\bid=["']${escapeRegex(el.id)}["'][^>]*)(/?>)`,
        'i',
      )
      s = s.replace(idRe, (match, head, tail) => {
        if (head.includes('data-demo-target')) return match
        return `${head} data-demo-target="${target}"${tail}`
      })
    }

    if (target === 'trigger' || target === 'submit' || target === 'button' || target === 'expand') {
      for (const needle of labelNeedles(el.label)) {
        const re = new RegExp(
          `(<button[^>]*>[\\s\\S]*?${escapeRegex(needle)}[\\s\\S]*?<\\/button>)`,
          'i',
        )
        s = s.replace(re, (match) => {
          if (match.includes('data-demo-target')) return match
          return match.replace('<button', `<button data-demo-target="${target}"`)
        })
      }
    }
  }

  if (!s.includes('data-demo-target="trigger"')) {
    s = s.replace(
      /(<button[^>]*className="[^"]*bg-white[^"]*text-black[^"]*"[^>]*>[\s\S]*?<\/button>)/i,
      (match) => {
        if (match.includes('data-demo-target')) return match
        return match.replace('<button', '<button data-demo-target="trigger"')
      },
    )
  }

  return s
}

function revealClass(stepVar, minStep) {
  return `\${(${stepVar} ?? -1) >= ${minStep} ? '' : ' opacity-0 translate-y-2 pointer-events-none'}`
}

const DEMO_PATCH_MARKER = '__PR_DEMO_PATCHED__'

const DEMO_STATE_FIELDS = `scheduleOpen = false, redirectOpen = false, typedText = '', redirectTypedText = '', demoHoverTrigger = false, hoverInput = false, demoHoverSubmit = false, modalEntrance = 0, revealStep = -1, dropdownOpen = false, demoHoverDropdown = false, showPayoff = false, highlightTarget = ''`

/**
 * Adds demo props to a Modal component so Remotion can drive entrance,
 * staged reveal, typing, and dropdown interactions.
 */
function patchRedirectModalSource(source, componentName) {
  if (source.includes('demoEntrance') && source.includes('redirect-name')) {
    return injectDemoTargets(source, [])
  }

  let s = source.replace(
    /(type \w+Props = \{[\s\S]*?)(\n\};)/,
    (match, head, tail) => {
      if (head.includes('demoEntrance')) return match
      return `${head}\n  demoName?: string;\n  demoHover?: boolean;\n  demoHoverSubmit?: boolean;\n  demoEntrance?: number;\n  demoRevealStep?: number;\n  demoDropdownOpen?: boolean;\n  demoHoverDropdown?: boolean;${tail}`
    },
  )

  s = s.replace(
    new RegExp(`(export function ${componentName}\\(\\{[\\s\\S]*?)(\\n\\}:)`),
    (match, head, tail) => {
      if (head.includes('demoEntrance')) return match
      return `${head.replace(/,\s*$/, '')},\n  demoName,\n  demoHover,\n  demoHoverSubmit = false,\n  demoEntrance = 0,\n  demoRevealStep = -1,\n  demoDropdownOpen = false,\n  demoHoverDropdown = false${tail}`
    },
  )

  s = s.replace(/value=\{name\}/g, 'value={demoName != null && demoName !== \'\' ? demoName : name}')

  s = s.replace(
    /className="absolute inset-0 bg-black\/70 backdrop-blur-sm"/,
    'className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300" style={{ opacity: demoEntrance }}',
  )

  s = s.replace(
    /className="relative max-h-\[90vh\] w-full max-w-lg overflow-y-auto rounded-xl border border-cal-border bg-cal-elevated shadow-2xl"/,
    `className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-cal-border bg-cal-elevated shadow-2xl transition-all duration-300"\n        style={{\n          opacity: demoEntrance,\n          transform: \`scale(\${0.94 + demoEntrance * 0.06}) translateY(\${(1 - demoEntrance) * 18}px)\`,\n        }}`,
  )

  s = s.replace(
    /<h2[^>]*id="[^"]+"[^>]*className="([^"]+)"/,
    `<h2 id="add-redirect-title" className={\`$1 transition-all duration-300${revealClass('demoRevealStep', 0)}\`}`,
  )

  s = s.replace(
    /<label[^>]*htmlFor="redirect-name"[^>]*>[\s\S]*?<\/label>\s*<input[\s\S]*?id="redirect-name"[\s\S]*?\/>/,
    (match) =>
      `<div className={\`space-y-2 transition-all duration-300${revealClass('demoRevealStep', 1)}\`} data-demo-target="input">\n              ${match.replace(
        /className="([^"]+)"/,
        `className={\`$1\${demoHover ? ' ${HOVER_RING}' : ''}\`}`,
      )}\n              </div>`,
  )

  s = s.replace(
    /<div className="grid grid-cols-2 gap-3">/,
    `<div className={\`grid grid-cols-2 gap-3 transition-all duration-300${revealClass('demoRevealStep', 2)}\`} data-demo-target="expand">`,
  )

  s = s.replace(
    /<fieldset className="space-y-2">/,
    `<fieldset className={\`space-y-2 transition-all duration-300${revealClass('demoRevealStep', 2)}\`}>`,
  )

  if (!s.includes('demoDropdownOpen ?')) {
    s = s.replace(
      /\{showColleaguePicker && \(\s*<div className="space-y-2">/,
      `{showColleaguePicker && (
              <div className={\`space-y-2 transition-all duration-300${revealClass('demoRevealStep', 2)}\`} data-demo-target="dropdown">`,
    )

    s = s.replace(
      /(<div className="relative">\s*<select\s+id="redirect-colleague")/,
      `<div className={\`relative\${demoHoverDropdown ? ' ${HOVER_RING}' : ''}\`}>
                    <select
                      id="redirect-colleague"`,
    )
  }

  s = s.replace(
    /type="submit"[^>]*className="([^"]+)"/,
    `type="submit" data-demo-target="submit" className={\`$1\${demoHoverSubmit ? ' ${HOVER_RING}' : ''}\`}`,
  )

  s = s.replace(
    /<div className="flex items-center justify-end gap-3 border-t border-cal-border bg-cal-surface px-6 py-4">/,
    `<div className={\`flex items-center justify-end gap-3 border-t border-cal-border bg-cal-surface px-6 py-4 transition-all duration-300${revealClass('demoRevealStep', 3)}\`}>`,
  )

  return s
}

export function patchModalSource(source, componentName) {
  if (/RedirectModal$/i.test(componentName)) {
    return patchRedirectModalSource(source, componentName)
  }

  if (source.includes('demoEntrance') && source.includes('demoRevealStep')) {
    return injectDemoTargets(source, [])
  }

  let s = source.replace(
    /(type \w+Props = \{[\s\S]*?)(\n\};)/,
    (match, head, tail) => {
      if (head.includes('demoEntrance')) return match
      return `${head}\n  demoName?: string;\n  demoHover?: boolean;\n  demoHoverSubmit?: boolean;\n  demoEntrance?: number;\n  demoRevealStep?: number;\n  demoDropdownOpen?: boolean;\n  demoHoverDropdown?: boolean;${tail}`
    },
  )

  s = s.replace(
    new RegExp(`(export function ${componentName}\\(\\{[\\s\\S]*?)(\\n\\}:)`),
    (match, head, tail) => {
      if (head.includes('demoEntrance')) return match
      return `${head.replace(/,\s*$/, '')},\n  demoName,\n  demoHover,\n  demoHoverSubmit = false,\n  demoEntrance = 0,\n  demoRevealStep = -1,\n  demoDropdownOpen = false,\n  demoHoverDropdown = false${tail}`
    },
  )

  s = s.replace(/value=\{name\}/g, 'value={demoName != null && demoName !== \'\' ? demoName : name}')

  s = s.replace(
    /id="schedule-name"[\s\S]*?className="([^"]+)"/,
    (match, classes) => {
      if (match.includes('demoHover')) return match
      return match.replace(
        `className="${classes}"`,
        `className={\`${classes}\${demoHover ? ' ${HOVER_RING}' : ''}\`}`,
      )
    },
  )

  s = s.replace(
    /className="absolute inset-0 bg-black\/70 backdrop-blur-sm"/,
    'className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity duration-300" style={{ opacity: demoEntrance }}',
  )

  s = s.replace(
    /className="relative w-full max-w-lg overflow-hidden rounded-xl border border-cal-border bg-cal-elevated shadow-2xl"/,
    `className={\`relative w-full max-w-lg overflow-hidden rounded-xl border border-cal-border bg-cal-elevated shadow-2xl transition-all duration-300\`}\n        style={{\n          opacity: demoEntrance,\n          transform: \`scale(\${0.94 + demoEntrance * 0.06}) translateY(\${(1 - demoEntrance) * 18}px)\`,\n        }}`,
  )

  s = s.replace(
    /<h2[^>]*id="[^"]+"[^>]*className="([^"]+)"/,
    `<h2 id="add-schedule-title" className={\`$1 transition-all duration-300${revealClass('demoRevealStep', 1)}\`}`,
  )

  s = s.replace(
    /<label[^>]*htmlFor="schedule-name"[^>]*>\s*Name\s*<\/label>\s*<input[\s\S]*?id="schedule-name"[\s\S]*?\/>/,
    (match) =>
      `<div className={\`space-y-2 transition-all duration-300${revealClass('demoRevealStep', 1)}\`}>\n              ${match}\n              </div>`,
  )

  s = s.replace(
    /<label[^>]*htmlFor="starting-hours"[^>]*>\s*Starting hours\s*<\/label>\s*<div className="relative">/,
    `<div className={\`space-y-2 transition-all duration-300${revealClass('demoRevealStep', 2)}\`}>\n              <label htmlFor="starting-hours" className="block text-sm font-medium text-white">\n                Starting hours\n              </label>\n              <div className={\`relative\${demoHoverDropdown ? ' ${HOVER_RING}' : ''}\`}>`,
  )

  if (
    s.includes('htmlFor="starting-hours"') &&
    s.includes(revealClass('demoRevealStep', 2)) &&
    !s.includes('</div>\n            </div>\n          </div>\n\n          <div className={`flex items-center justify-end')
  ) {
    s = s.replace(
      /(<ChevronDown className="pointer-events-none absolute right-3 top-1\/2 h-4 w-4 -translate-y-1\/2 text-cal-muted" \/>\s*<\/div>\s*<\/div>\s*)(<\/div>\s*\n\s*<div className=\{\`flex items-center justify-end)/,
      `$1            </div>\n          $2`,
    )
  }

  if (!s.includes('demoDropdownOpen ?')) {
    const beforeDropdown = s
    s = s.replace(
      /<div className=\{\`relative[\s\S]*?\}\}>\s*<select/,
      `{demoDropdownOpen ? (
                <div className="overflow-hidden rounded-md border border-cal-border bg-cal-bg shadow-lg" data-demo-target="dropdown">
                  {STARTING_HOURS_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={\`px-3 py-2.5 text-sm \${preset === option.value ? 'bg-cal-elevated text-white' : 'text-cal-muted'}\`}
                    >
                      {option.label}
                    </div>
                  ))}
                </div>
              ) : (
                <div className={\`relative\${demoHoverDropdown ? ' ${HOVER_RING}' : ''}\`}>
                <select`,
    )

    if (s !== beforeDropdown) {
      s = s.replace(
        /<ChevronDown className="pointer-events-none absolute right-3 top-1\/2 h-4 w-4 -translate-y-1\/2 text-cal-muted" \/>\s*<\/div>/,
        `<ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cal-muted" />
                </div>
              )}
              </div>`,
      )
    }
  }

  s = s.replace(
    /type="submit"[^>]*className="([^"]+)"/,
    `type="submit" data-demo-target="submit" className={\`$1\${demoHoverSubmit ? ' ${HOVER_RING}' : ''}\`}`,
  )

  s = s.replace(
    /<div className="flex items-center justify-end gap-3 border-t border-cal-border bg-cal-surface px-6 py-4">/,
    `<div className={\`flex items-center justify-end gap-3 border-t border-cal-border bg-cal-surface px-6 py-4 transition-all duration-300${revealClass('demoRevealStep', 3)}\`}>`,
  )

  return s
}

function wireModalProps(block) {
  return block.replace(
    /<AddScheduleModal\n(\s+)open=\{modalOpen\}/,
    `<AddScheduleModal\n$1open={modalOpen}\n$1demoName={typedText || undefined}\n$1demoHover={hoverInput}\n$1demoHoverSubmit={demoHoverSubmit}\n$1demoEntrance={modalEntrance}\n$1demoRevealStep={revealStep}\n$1demoDropdownOpen={dropdownOpen}\n$1demoHoverDropdown={demoHoverDropdown}`,
  )
}

export function patchPageSource(source, demoScript) {
  if (source.includes(DEMO_PATCH_MARKER)) return source

  const showSchedule = demoScript.type !== 'page-redirect'
  const showRedirect = demoScript.type === 'page-redirect' || demoScript.type === 'page'

  let s = source

  s = s.replace(
    /(export(?:\s+default)?\s+function\s+\w+Page)\(\)\s*\{/,
    `$1({ demoState = {} }) {\n  const { ${DEMO_STATE_FIELDS} } = demoState;`,
  )

  if (!s.includes('visibleSchedules')) {
    s = s.replace(
      /const \[schedules, setSchedules\] = useState<Schedule\[\]>\(initialSchedules\);/,
      `const [schedules, setSchedules] = useState<Schedule[]>(initialSchedules);
  const visibleSchedules = showPayoff
    ? [
        ...schedules,
        {
          id: "demo-created",
          name: typedText || "New schedule",
          isDefault: false,
          timeRanges: schedules[0]?.timeRanges ?? initialSchedules[0]?.timeRanges ?? [],
        },
      ]
    : schedules;`,
    )
    s = s.replace(/schedules\.map\(\(schedule\)/g, 'visibleSchedules.map((schedule)')
  }

  if (demoScript.type === 'page-redirect' && !s.includes('visibleRedirects')) {
    s = s.replace(
      /const \[redirects, setRedirects\] = useState<Redirect\[\]>\(\[\]\);/,
      `const [redirects, setRedirects] = useState<Redirect[]>([]);
  const visibleRedirects = showPayoff
    ? [
        ...redirects,
        {
          id: "demo-redirect",
          name: redirectTypedText || "Out of office",
          startDate: "2026-07-01",
          endDate: "2026-07-14",
          mode: "specific" as const,
          colleagueId: teammates[0]?.id,
        },
      ]
    : redirects;`,
    )
    s = s.replace(/redirects\.length > 0/g, 'visibleRedirects.length > 0')
    s = s.replace(/redirects\.map\(\(redirect\)/g, 'visibleRedirects.map((redirect)')
  }

  s = s.replace(
    /const \[modalOpen, setModalOpen\] = useState\(false\);/,
    'const modalOpen = scheduleOpen;',
  )
  s = s.replace(
    /const \[redirectModalOpen, setRedirectModalOpen\] = useState\(false\);/,
    'const redirectModalOpen = redirectOpen;',
  )

  s = s.replace(/setModalOpen\(false\)/g, 'undefined')
  s = s.replace(/setModalOpen\(true\)/g, 'undefined')
  s = s.replace(/setRedirectModalOpen\(false\)/g, 'undefined')
  s = s.replace(/setRedirectModalOpen\(true\)/g, 'undefined')

  s = s.replace(
    /(<button[^>]*data-demo-target="trigger"[^>]*className=)(["'])([^"']*)(["'])/,
    `$1{\`$3\${demoHoverTrigger ? ' ${HOVER_RING}' : ''}\`}`,
  )
  s = s.replace(
    /className="([^"]*bg-white[^"]*text-black[^"]*)"/,
    `className={\`$1\${demoHoverTrigger ? ' ${HOVER_RING}' : ''}\`}`,
  )

  s = s.replace(/aria-label="More options"/, 'aria-label="More options" data-demo-target="button"')

  s = s.replace(
    /(data-demo-target="button"[^>]*className=")([^"]+)(")/,
    `$1{\`$2\${demoHoverTrigger ? ' ${HOVER_RING}' : ''}\`}$3`,
  )

  if (!s.includes('data-demo-region="main-content"')) {
    s = s.replace(
      /(<div className="space-y-4">\s*\{visibleSchedules\.map)/,
      `<div data-demo-region="main-content"><div className="space-y-4">{visibleSchedules.map`,
    )
    s = s.replace(
      /(<div className="mt-4 overflow-hidden rounded-lg border border-cal-border">[\s\S]*?<\/div>\s*<\/div>\s*)(<\/>)/,
      `$1</div>$2`,
    )
  }

  if (demoScript.type === 'page-redirect') {
    s = s.replace(
      /className={\`([^`]*bg-white[^`]*)\$\{demoHoverTrigger \? '[^']+' : ''\}\`\}/,
      'className={`$1`}',
    )
    s = s.replace(
      /(<button\s+type="button"\s+onClick=\{\(\) => undefined\}\s+className=")(font-medium text-white underline-offset-2 hover:underline)(")/,
      `$1\${demoHoverTrigger ? '${HOVER_RING} ' : ''}$2$3 data-demo-target="trigger"`,
    )
  }

  if (showSchedule) {
    s = wireModalProps(s)
  }

  if (showRedirect) {
    s = s.replace(
      /<AddRedirectModal\n([\s\S]*?)open=\{redirectModalOpen\}/,
      `<AddRedirectModal\n$1open={redirectModalOpen}\n        demoName={redirectTypedText || undefined}\n        demoHover={hoverInput}\n        demoHoverSubmit={demoHoverSubmit}\n        demoEntrance={modalEntrance}\n        demoRevealStep={revealStep}\n        demoDropdownOpen={dropdownOpen}\n        demoHoverDropdown={demoHoverDropdown}`,
    )
  }

  if (!s.includes(DEMO_PATCH_MARKER)) {
    s = `/* ${DEMO_PATCH_MARKER} */\n${s}`
  }

  return s
}

export function patchTableSource(source, componentName, _demoScript = {}) {
  if (source.includes('demoState') && source.includes('demoHoverExpand')) return source

  let s = source

  s = s.replace(
    new RegExp(`(export(?:\\s+default)?\\s+function\\s+${componentName})\\(\\)\\s*\\{`),
    `$1({ demoState = {} }) {\n  const { expanded = false, demoHoverExpand = false, highlightTarget = '' } = demoState;`,
  )

  s = s.replace(
    /const \[expandedId, setExpandedId\] = useState<string \| null>\(null\);/,
    'const expandedId = expanded ? (teammates[0]?.id ?? null) : null;',
  )

  s = s.replace(
    /className="([^"]*text-cal-muted[^"]*transition[^"]*)"/,
    `className={\`$1\${demoHoverExpand ? ' ${HOVER_RING}' : ''}\`}`,
  )

  return s
}

export function patchClosureForDemo(closure, demoRoot, demoScript, demoScene = null) {
  const patched = new Map(closure)
  const { mode } = demoRoot
  const elementsByComponent = Object.fromEntries(
    (demoScene?.components ?? []).map((c) => [c.name, c.elements ?? []]),
  )

  for (const [path, source] of closure) {
    const fileName = path.split('/').pop()?.replace(/\.\w+$/, '') ?? ''
    const fileElements = elementsByComponent[fileName] ?? []

    let s = patchGenericDemoSource(source, fileName, fileElements)
    s = injectDemoTargets(s, fileElements)

    if (/Modal$/i.test(fileName)) {
      s = injectDemoTargets(patchModalSource(s, fileName), fileElements)
    }

    if (mode === 'page' && /Page$/i.test(fileName)) {
      s = injectDemoTargets(patchPageSource(s, demoScript), fileElements)
    }

    if ((mode === 'table' || demoScript.type === 'table') && /Table$/i.test(fileName)) {
      s = injectDemoTargets(patchTableSource(s, fileName, demoScript), fileElements)
    }

    patched.set(path, s)
  }

  return patched
}

export const DEMO_HOVER_CSS = `
#pr-preview-root[data-demo-hide-rest="true"] [data-demo-region="main-content"] {
  opacity: 0.18;
  filter: blur(4px);
  transform: scale(0.98);
  transition: opacity 0.35s ease, filter 0.35s ease, transform 0.35s ease;
  pointer-events: none;
}
#pr-preview-root[data-demo-focus-ref] [data-demo-ref] {
  transition: transform 0.25s ease, opacity 0.25s ease, box-shadow 0.25s ease;
}
#pr-preview-root[data-demo-hide-rest="true"] [data-demo-ref] {
  opacity: 0.12;
  filter: blur(2px);
  pointer-events: none;
}

#pr-preview-root[data-demo-phase="hover"] [data-demo-region="main-content"] {
  opacity: 0.22;
  filter: blur(3px);
  transform: scale(0.985);
  transition: opacity 0.35s ease, filter 0.35s ease, transform 0.35s ease;
  pointer-events: none;
}
#pr-preview-root[data-demo-phase="establish"] [data-demo-region="main-content"] {
  opacity: 1;
  filter: none;
  transform: none;
}
#pr-preview-root[data-demo-phase="isolate"] [data-demo-target="trigger"],
#pr-preview-root[data-demo-phase="hover"] [data-demo-target="trigger"],
#pr-preview-root[data-demo-phase="click"] [data-demo-target="trigger"],
#pr-preview-root[data-demo-highlight="trigger"] [data-demo-target="trigger"] {
  position: relative;
  z-index: 30;
  transform: scale(1.04);
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
#pr-preview-root[data-demo-highlight="button"] [data-demo-target="button"],
#pr-preview-root[data-demo-phase="isolate"] [data-demo-highlight="button"] [data-demo-target="button"],
#pr-preview-root[data-demo-phase="hover"] [data-demo-highlight="button"] [data-demo-target="button"] {
  outline: 2px solid rgba(165, 180, 252, 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(165, 180, 252, 0.18);
}
#pr-preview-root [data-demo-target="trigger"].demo-active,
#pr-preview-root [data-demo-highlight="trigger"] [data-demo-target="trigger"],
#pr-preview-root [data-demo-highlight="trigger"] button.bg-white {
  outline: 2px solid rgba(165, 180, 252, 0.9);
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(165, 180, 252, 0.18);
}
#pr-preview-root [data-demo-target="input"].demo-active,
#pr-preview-root [data-demo-highlight="input"] [data-demo-target="input"],
#pr-preview-root [data-demo-highlight="input"] input {
  outline: 2px solid rgba(165, 180, 252, 0.9);
  outline-offset: 2px;
}
#pr-preview-root [data-demo-target="dropdown"].demo-active,
#pr-preview-root [data-demo-highlight="dropdown"] [data-demo-target="dropdown"],
#pr-preview-root [data-demo-highlight="dropdown"] select {
  outline: 2px solid rgba(165, 180, 252, 0.9);
  outline-offset: 2px;
}
#pr-preview-root [data-demo-target="submit"].demo-active,
#pr-preview-root [data-demo-highlight="submit"] [data-demo-target="submit"] {
  outline: 2px solid rgba(165, 180, 252, 0.9);
  outline-offset: 2px;
}
#pr-preview-root [data-demo-phase="payoff"] .space-y-4 > :last-child {
  animation: demoPayoffIn 0.45s ease-out both;
}
@keyframes demoPayoffIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
`
