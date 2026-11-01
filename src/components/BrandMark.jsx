export default function BrandMark({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`brand-mark-svg ${className}`}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="brandGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C5CFF" />
          <stop offset="100%" stopColor="#22D3EE" />
        </linearGradient>
        <linearGradient id="brandGlow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6D4AFF" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#2A6BFF" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      {/* Background rounded squircle */}
      <rect width="40" height="40" rx="10" fill="url(#brandGlow)" />
      <rect
        x="0.75"
        y="0.75"
        width="38.5"
        height="38.5"
        rx="9.25"
        stroke="url(#brandGradient)"
        strokeWidth="1.5"
        strokeOpacity="0.5"
      />
      {/* Stylized Tooth & Smile curve icon */}
      <path
        d="M20 9C15.2 9 12 11.8 12 16.2C12 20.1 13.8 24.2 15.5 28.6C16.3 30.5 18 31 19.3 29.8L20 29.1L20.7 29.8C22 31 23.7 30.5 24.5 28.6C26.2 24.2 28 20.1 28 16.2C28 11.8 24.8 9 20 9Z"
        fill="url(#brandGradient)"
        fillOpacity="0.18"
      />
      <path
        d="M20 9C15.2 9 12 11.8 12 16.2C12 20.1 13.8 24.2 15.5 28.6C16.3 30.5 18 31 19.3 29.8L20 29.1L20.7 29.8C22 31 23.7 30.5 24.5 28.6C26.2 24.2 28 20.1 28 16.2C28 11.8 24.8 9 20 9Z"
        stroke="url(#brandGradient)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Smiling curve accent */}
      <path
        d="M16 17C17.3 19 22.7 19 24 17"
        stroke="#22D3EE"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

