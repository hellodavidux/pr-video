/**
 * Generic demo patches — wire ANY React component to demoState without cal.com-specific regex.
 */

const MARKER = '__PR_GENERIC_DEMO__'

const DEMO_STATE_FIELDS = `open = false, scheduleOpen = false, redirectOpen = false, typedText = '', redirectTypedText = '', demoHoverTrigger = false, hoverInput = false, demoHoverSubmit = false, demoHoverExpand = false, demoHoverDropdown = false, modalEntrance = 0, revealStep = -1, dropdownOpen = false, expanded = false, showPayoff = false, highlightTarget = '', focusRef = ''`

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function exportFunctionRegex(componentName) {
  return new RegExp(
    `(export(?:\\s+default)?\\s+function\\s+${escapeRegex(componentName)}\\s*\\()([\\s\\S]*?)(\\))\\s*\\{`,
  )
}

function addDemoStateParam(source, componentName) {
  const fnRe = exportFunctionRegex(componentName)
  const m = source.match(fnRe)
  if (!m) return source

  const params = m[2].trim()
  if (params.includes('demoState')) return source

  // TypeScript destructured params (end with `}: TypeName`)
  if (params.includes('}:')) {
    let newParams
    if (/\.\.\.\w+/.test(params)) {
      newParams = params.replace(/(\.\.\.\w+)([\s\S]*?)\n(\s*)}\s*:/, 'demoState = {},\n  $1$2\n$3}:')
    } else if (/\n/.test(params)) {
      newParams = params.replace(/,?\n(\s*)}\s*:/, ',\n$1demoState = {},\n$1}:')
    } else {
      newParams = params.replace(/({[\s\S]*?)(})\s*:/, '$1, demoState = {}$2:')
    }
    newParams = newParams.replace(/(:\s*)(\S[\s\S]*?)$/, '$1$2 & { demoState?: Record<string, unknown> }')
    return source.replace(fnRe, `$1${newParams}$3 {`)
  }

  // Destructured object params without a separate TS type annotation
  if (params.startsWith('{')) {
    const nextParams = params.endsWith('}')
      ? params.replace(/}\s*$/, ', demoState = {} }')
      : `${params}, demoState = {} }`
    return source.replace(fnRe, `$1${nextParams}$3 {`)
  }

  // Plain typed or untyped params: deps: readonly unknown[], onClick: () => void
  const nextParams = params.length === 0 ? '{ demoState = {} }' : `${params}, demoState = {}`
  return source.replace(fnRe, `$1${nextParams}$3 {`)
}

function extractParamNames(params) {
  const withoutType = params.replace(/}:\s*[\s\S]*$/, '')
  const names = new Set()
  for (const part of withoutType.split(',')) {
    const name = part.trim().replace(/[{}]/g, '').split(/[=?:]/)[0].trim()
    if (name && /^[a-zA-Z_$]/.test(name)) names.add(name)
  }
  return names
}

function injectDemoStateDestructuring(source, componentName) {
  const fnRe = exportFunctionRegex(componentName)
  const m = source.match(fnRe)
  if (!m) return source
  if (!m[2].includes('demoState')) return source
  if (source.includes('const { open = false')) return source

  const existingParams = extractParamNames(m[2])

  const filteredFields = DEMO_STATE_FIELDS
    .split(',')
    .filter((f) => {
      const name = f.trim().split('=')[0].trim()
      return name && !existingParams.has(name)
    })
    .join(', ')

  if (!filteredFields.trim()) return source

  return source.replace(
    new RegExp(`(export(?:\\s+default)?\\s+function\\s+${escapeRegex(componentName)}\\s*\\([\\s\\S]*?\\)\\s*\\{)\\s*`),
    `$1\n  const { ${filteredFields} } = demoState;\n  `,
  )
}

function wireOpenStateHooks(source) {
  if (!source.includes('const { open = false')) return source

  return source.replace(
    /const \[(\w+),\s*set\w+\]\s*=\s*useState\((?:false|true)\);/g,
    (match, name) => {
      if (!/(?:^|[A-Z])(?:open|Open|visible|Visible|show|Show|expanded|Expanded)/.test(name)) {
        return match
      }
      if (/redirect/i.test(name)) {
        return `const ${name} = redirectOpen;`
      }
      if (/schedule|modal/i.test(name) || name === 'open' || name === 'isOpen') {
        return `const ${name} = scheduleOpen || open || redirectOpen;`
      }
      if (/expand/i.test(name)) {
        return `const ${name} = expanded;`
      }
      return `const ${name} = open || scheduleOpen || redirectOpen;`
    },
  )
}

function wireDemoInputValues(source) {
  let s = source

  s = s.replace(
    /(<input[^>]*data-demo-target="input"[^>]*\svalue=\{)(\w+)(\}[^>]*\/?>)/gi,
    `$1typedText !== '' ? typedText : $2$3`,
  )

  s = s.replace(
    /(<textarea[^>]*data-demo-target="input"[^>]*\svalue=\{)(\w+)(\}[^>]*>)/gi,
    `$1typedText !== '' ? typedText : $2$3`,
  )

  return s
}

function wireModalEntrance(source) {
  if (source.includes('demoEntrance')) return source

  let s = source

  s = s.replace(
    /className="([^"]*fixed[^"]*inset-0[^"]*bg-black[^"]*)"/,
    'className="$1 transition-opacity duration-300" style={{ opacity: modalEntrance || (open || scheduleOpen || redirectOpen ? 1 : 0) }}',
  )

  s = s.replace(
    /className="([^"]*relative[^"]*max-w-(?:lg|xl|2xl|3xl)[^"]*rounded[^"]*)"/,
    `className="$1 transition-all duration-300" style={{ opacity: modalEntrance || (open || scheduleOpen || redirectOpen ? 1 : 0), transform: \`scale(\${0.94 + (modalEntrance || (open ? 1 : 0)) * 0.06}) translateY(\${(1 - (modalEntrance || (open ? 1 : 0))) * 16}px)\` }}`,
  )

  return s
}

function wireModalChildProps(source) {
  return source.replace(
    /<(\w+Modal)\s([^>]*?)open=\{(\w+)\}/g,
    (match, name, attrs, openVar) => {
      if (attrs.includes('demoEntrance')) return match
      return `<${name} ${attrs}open={${openVar}} demoName={typedText || undefined} demoHover={hoverInput} demoHoverSubmit={demoHoverSubmit} demoEntrance={modalEntrance} demoRevealStep={revealStep} demoDropdownOpen={dropdownOpen} demoHoverDropdown={demoHoverDropdown}`
    },
  )
}

/**
 * Patch any component source to respond to Remotion demoState.
 */
export function patchGenericDemoSource(source, componentName, elements = []) {
  if (!source || source.includes(MARKER)) return source
  // React hooks and non-component helpers should not receive demoState wiring.
  if (/^use[A-Z]/.test(componentName)) return source

  let s = source
  s = addDemoStateParam(s, componentName)
  s = injectDemoStateDestructuring(s, componentName)
  s = wireOpenStateHooks(s)
  s = wireDemoInputValues(s)

  if (/Page$/i.test(componentName)) {
    s = wireModalChildProps(s)
  }

  if (/Modal$/i.test(componentName)) {
    s = wireModalEntrance(s)
    s = wireDemoInputValues(s)
  }

  if (/Table$/i.test(componentName)) {
    s = s.replace(
      /const \[expandedId,\s*setExpandedId\]\s*=\s*useState[^;]+;/,
      'const expandedId = expanded ? (items?.[0]?.id ?? rows?.[0]?.id ?? null) : null;',
    )
  }

  return `/* ${MARKER} */\n${s}`
}
