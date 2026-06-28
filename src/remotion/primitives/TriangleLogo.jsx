export function TriangleLogo({ size = 48, color = '#5E6AD2', strokeWidth = 1.5, style = {} }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={{ display: 'block', ...style }}
      aria-hidden
    >
      <path
        d="M24 8 L40 38 H8 Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
      />
    </svg>
  )
}
