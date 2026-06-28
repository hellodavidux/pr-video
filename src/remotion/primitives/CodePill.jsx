import { useProductTheme } from '../theme/ProductThemeContext.jsx'

export function CodePill({ label, active = false }) {
  const theme = useProductTheme()
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: 6,
        background: active ? `${theme.accent}22` : theme.surface,
        border: `1px solid ${active ? `${theme.accent}55` : theme.surfaceBorder}`,
        color: active ? theme.text : theme.textSecondary,
        fontFamily: theme.fontMono,
        fontSize: 12,
        letterSpacing: '-0.01em',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  )
}

export function CodePillRow({ paths = [], highlightIndex = -1 }) {
  if (!paths.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 20 }}>
      {paths.map((p, i) => (
        <CodePill key={p} label={p} active={i === highlightIndex} />
      ))}
    </div>
  )
}
