const STATUS_COLORS = {
  added: '#7bc47b',
  removed: '#e24b4a',
  modified: '#7f99dd',
  renamed: '#ef9f27',
}

const LINE_COLORS = {
  add: { bg: 'rgba(46, 160, 67, 0.18)', text: '#aff5b4' },
  remove: { bg: 'rgba(248, 81, 73, 0.18)', text: '#ffb1af' },
  context: { bg: 'transparent', text: 'rgba(255,255,255,0.45)' },
}

export function CodeChangeVisual({
  filename,
  highlightLines = [],
  status = 'modified',
  size = 'sm',
}) {
  const fontSize = size === 'lg' ? 18 : 11
  const lineHeight = size === 'lg' ? 1.55 : 1.45
  const statusColor = STATUS_COLORS[status] ?? STATUS_COLORS.modified

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: '#0d0f12',
        borderRadius: size === 'lg' ? 20 : 16,
        border: '1px solid #2e3138',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      }}
    >
      <div
        style={{
          padding: size === 'lg' ? '16px 20px' : '10px 14px',
          background: '#111318',
          borderBottom: '1px solid #2e3138',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <span
          style={{
            fontSize: size === 'lg' ? 14 : 10,
            fontWeight: 600,
            color: statusColor,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          {status}
        </span>
        <span
          style={{
            fontSize: size === 'lg' ? 16 : 11,
            color: '#afa9ec',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {filename}
        </span>
      </div>

      <div
        style={{
          flex: 1,
          overflow: 'hidden',
          padding: size === 'lg' ? '16px 0' : '8px 0',
        }}
      >
        {highlightLines.length === 0 ? (
          <div
            style={{
              padding: '20px 24px',
              color: '#666',
              fontSize: size === 'lg' ? 20 : 12,
            }}
          >
            Diff too large to preview — open the file on GitHub
          </div>
        ) : (
          highlightLines.map((line, i) => {
            const colors = LINE_COLORS[line.type] ?? LINE_COLORS.context
            return (
              <div
                key={`${line.type}-${i}`}
                style={{
                  padding: size === 'lg' ? '4px 24px' : '2px 14px',
                  background: colors.bg,
                  color: colors.text,
                  fontSize,
                  lineHeight,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                <span style={{ opacity: 0.5, marginRight: 8 }}>
                  {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                </span>
                {line.text}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
