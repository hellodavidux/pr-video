import { DEMO_HOVER_CSS } from './patchForDemo.js'

function parseThemeVariables(css) {
  const vars = {}
  if (!css) return vars
  for (const m of css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    vars[m[1]] = m[2].trim()
  }
  return vars
}

export function buildTailwindConfig(css) {
  const colors = {}
  const fontFamily = {}
  if (css) {
    for (const m of css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
      colors[m[1]] = m[2].trim()
    }
    for (const m of css.matchAll(/--font-([\w-]+):\s*([^;]+);/g)) {
      const primary = m[2].trim().split(',')[0].replace(/["']/g, '').trim()
      fontFamily[m[1]] = [primary, 'ui-sans-serif', 'system-ui', 'sans-serif']
    }
  }
  return {
    important: '#pr-preview-root',
    corePlugins: { preflight: false },
    theme: {
      extend: {
        ...(Object.keys(colors).length > 0 && { colors }),
        ...(Object.keys(fontFamily).length > 0 && { fontFamily }),
      },
    },
  }
}

export function buildStylesheet(css) {
  const vars = parseThemeVariables(css)
  const bg = vars['cal-bg'] ?? '#101010'
  const lines = [
    '#pr-preview-root {',
    '  margin: 0;',
    `  background: ${bg};`,
    '  color: #fafafa;',
    '  font-family: Inter, system-ui, sans-serif;',
    '  -webkit-font-smoothing: antialiased;',
    '  color-scheme: dark;',
    '}',
    '#pr-preview-root *, #pr-preview-root *::before, #pr-preview-root *::after { box-sizing: border-box; }',
    DEMO_HOVER_CSS.trim(),
  ]

  for (const [name, value] of Object.entries(vars)) {
    lines.push(`#pr-preview-root .bg-${name} { background-color: ${value} !important; }`)
    lines.push(`#pr-preview-root .text-${name} { color: ${value} !important; }`)
    lines.push(`#pr-preview-root .border-${name} { border-color: ${value} !important; }`)
    lines.push(`#pr-preview-root .ring-${name} { --tw-ring-color: ${value}; }`)
    lines.push(`#pr-preview-root .ring-offset-${name} { --tw-ring-offset-color: ${value}; }`)
    lines.push(`#pr-preview-root .placeholder\\:text-${name}::placeholder { color: ${value} !important; }`)
    lines.push(`#pr-preview-root .hover\\:text-${name}:hover { color: ${value} !important; }`)
  }

  const elevated = vars['cal-elevated'] ?? '#1c1c1c'
  const border = vars['cal-border'] ?? '#2a2a2a'
  const muted = vars['cal-muted'] ?? '#a1a1aa'
  lines.push(
    `#pr-preview-root input, #pr-preview-root select, #pr-preview-root textarea {`,
    `  background-color: ${bg} !important;`,
    `  border-color: ${border} !important;`,
    `  color: #fafafa !important;`,
    `  color-scheme: dark;`,
    `}`,
    `#pr-preview-root option { background-color: ${elevated}; color: #fafafa; }`,
    `#pr-preview-root .bg-cal-elevated, #pr-preview-root [class*="bg-cal-elevated"] { background-color: ${elevated} !important; }`,
    `#pr-preview-root .text-cal-muted, #pr-preview-root [class*="text-cal-muted"] { color: ${muted} !important; }`,
  )

  return lines.join('\n')
}

export function buildStylesheetFromConfig(tailwindConfig) {
  const colors = tailwindConfig?.theme?.extend?.colors ?? {}
  if (Object.keys(colors).length === 0) return ''
  const cssLines = Object.entries(colors).map(([k, v]) => `--color-${k}: ${v};`)
  return buildStylesheet(cssLines.join('\n'))
}
