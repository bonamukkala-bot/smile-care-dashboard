export default function BrandMark({ size = 36, className = '' }) {
  const gradientId = 'brandMarkToothGrad'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-mark-svg ${className}`.trim()}
      role="img"
      aria-label="Smile Care"
    >
      <title>Smile Care</title>
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>
        <linearGradient id="brandMarkGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0.06" />
        </linearGradient>
      </defs>

      {/* Subtle soft container fill for contrast */}
      <rect
        width="40"
        height="40"
        rx="10"
        fill="url(#brandMarkGlow)"
        stroke="url(#brandMarkToothGrad)"
        strokeWidth="1"
        strokeOpacity="0.3"
      />

      {/* Outlined tooth logo (molar contour) */}
      <path
        d="M20 7.8C15 7.8 11.2 10.6 11.2 15.6C11.2 20 13.2 24.6 15.2 29.2C16.1 31.4 17.8 32 19.1 30.7L20 29.8L20.9 30.7C22.2 32 23.9 31.4 24.8 29.2C26.8 24.6 28.8 20 28.8 15.6C28.8 10.6 25 7.8 20 7.8Z"
        stroke={`url(#${gradientId})`}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Inner highlight contour on top-left crown */}
      <path
        d="M14.5 13C15.6 10.5 17.6 9.8 20 9.8"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />

      {/* Gentle smiling arc inside */}
      <path
        d="M16 19C17.4 21.2 22.6 21.2 24 19"
        stroke="#22D3EE"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
