const DEFAULT_THEME = {
  background: '#0A0A0A',
  backgroundElevated: '#121212',
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.55)',
  textSecondary: '#A1A1A1',
  surface: '#1A1A1A',
  surfaceBorder: 'rgba(255,255,255,0.06)',
  accent: '#5E6AD2',
  fontDisplay: "'Inter', 'SF Pro Display', system-ui, sans-serif",
  fontMono: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
  radius: '10px',
  productName: 'Product',
}

function firstFontFamily(value) {
  if (!value) return null
  return value.split(',')[0].replace(/["']/g, '').trim()
}

function parseCssVars(css) {
  const vars = {}
  if (!css) return vars
  for (const m of css.matchAll(/--color-([\w-]+):\s*([^;]+);/g)) {
    vars[`color-${m[1]}`] = m[2].trim()
  }
  for (const m of css.matchAll(/--font-([\w-]+):\s*([^;]+);/g)) {
    vars[`font-${m[1]}`] = m[2].trim()
  }
  return vars
}

function pickAccent(vars, brand) {
  if (brand?.accentColor) return brand.accentColor
  const candidates = [
    vars['color-brand'],
    vars['color-accent'],
    vars['color-primary'],
    vars['color-brand-default'],
    vars['color-indigo'],
  ]
  return candidates.find(Boolean) ?? DEFAULT_THEME.accent
}

function pickBackground(vars) {
  return (
    vars['color-cal-bg'] ??
    vars['color-background'] ??
    vars['color-bg'] ??
    DEFAULT_THEME.background
  )
}

/**
 * Build a Remotion-ready theme from repo CSS and marketing brand hints.
 */
export function parseProductTheme(css, { brand, repo } = {}) {
  const vars = parseCssVars(css)
  const sans = firstFontFamily(vars['font-sans'] ?? vars['font-body'])
  const mono = firstFontFamily(vars['font-mono'])

  const repoShort = repo?.replace(/^.*\//, '') ?? 'Product'

  return {
    ...DEFAULT_THEME,
    background: pickBackground(vars),
    backgroundElevated: vars['color-cal-bg-emphasis'] ?? vars['color-muted'] ?? DEFAULT_THEME.backgroundElevated,
    surface: vars['color-cal-bg-subtle'] ?? vars['color-card'] ?? DEFAULT_THEME.surface,
    accent: pickAccent(vars, brand),
    fontDisplay: sans ? `'${sans}', system-ui, sans-serif` : DEFAULT_THEME.fontDisplay,
    fontMono: mono ? `'${mono}', monospace` : DEFAULT_THEME.fontMono,
    productName: repoShort.charAt(0).toUpperCase() + repoShort.slice(1),
  }
}

export { DEFAULT_THEME }
