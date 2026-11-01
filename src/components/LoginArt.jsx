export default function LoginArt({ className = '' }) {
  return (
    <svg
      viewBox="0 0 520 620"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`login-art-svg ${className}`.trim()}
      aria-hidden="true"
    >
      <defs>
        {/* Soft radial glow behind tooth */}
        <radialGradient id="artToothGlow" cx="50%" cy="42%" r="48%">
          <stop offset="0%" stopColor="#6D4AFF" stopOpacity="0.25" />
          <stop offset="45%" stopColor="#22D3EE" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#050818" stopOpacity="0" />
        </radialGradient>

        {/* Translucent tooth glassy gradient */}
        <linearGradient id="artToothGlass" x1="20%" y1="15%" x2="80%" y2="85%">
          <stop offset="0%" stopColor="#67E8F9" stopOpacity="0.30" />
          <stop offset="60%" stopColor="#4F46E5" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0.15" />
        </linearGradient>

        {/* Rim light gradient */}
        <linearGradient id="artRimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0F2FE" />
          <stop offset="50%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#7C5CFF" />
        </linearGradient>

        {/* Leaf 1 gradient */}
        <linearGradient id="artLeafGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0D9488" stopOpacity="0.25" />
          <stop offset="50%" stopColor="#2DD4BF" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#A7F3D0" stopOpacity="0.30" />
        </linearGradient>

        {/* Leaf 2 gradient */}
        <linearGradient id="artLeafGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0F766E" stopOpacity="0.20" />
          <stop offset="60%" stopColor="#14B8A6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#5EEAD4" stopOpacity="0.25" />
        </linearGradient>

        {/* Glowing sweep lines */}
        <linearGradient id="artSweepGrad1" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7C5CFF" stopOpacity="0.2" />
          <stop offset="40%" stopColor="#22D3EE" stopOpacity="0.75" />
          <stop offset="100%" stopColor="#67E8F9" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="artSweepGrad2" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#6D4AFF" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#818CF8" stopOpacity="0.65" />
          <stop offset="100%" stopColor="#22D3EE" stopOpacity="0.1" />
        </linearGradient>

        <linearGradient id="artSweepGrad3" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0891B2" stopOpacity="0.2" />
          <stop offset="60%" stopColor="#22D3EE" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7C5CFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Large radial glow behind the tooth */}
      <circle cx="260" cy="275" r="230" fill="url(#artToothGlow)" />

      {/* Sweeping glowing curve lines (bottom-left to top-right) */}
      <path
        d="M-20 515 C130 455 310 525 540 425"
        stroke="url(#artSweepGrad1)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M-10 545 C160 490 330 555 540 470"
        stroke="url(#artSweepGrad2)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M20 585 C200 525 360 575 540 515"
        stroke="url(#artSweepGrad3)"
        strokeWidth="1.4"
        strokeLinecap="round"
      />

      {/* Layered flowing dark wave/hill shapes at the base */}
      <path
        d="M-20 485 C120 445 280 520 540 465 L540 640 L-20 640 Z"
        fill="#0B1333"
        fillOpacity="0.82"
      />
      <path
        d="M-20 525 C140 480 300 555 540 500 L540 640 L-20 640 Z"
        fill="#0E173E"
        fillOpacity="0.9"
      />
      <path
        d="M-20 565 C170 525 340 575 540 540 L540 640 L-20 640 Z"
        fill="#070C22"
      />

      {/* Translucent teal leaves growing from lower-left */}
      {/* Leaf 1 (larger, angled towards center) */}
      <path
        d="M115 505 C90 450 115 395 168 375 C178 415 162 470 115 505 Z"
        fill="url(#artLeafGrad1)"
        stroke="#2DD4BF"
        strokeWidth="1"
        strokeOpacity="0.5"
      />
      {/* Central vein for Leaf 1 */}
      <path
        d="M115 505 C132 458 148 424 168 375"
        stroke="#A7F3D0"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
      {/* Secondary subtle veins */}
      <path
        d="M136 450 C146 444 156 445 162 449"
        stroke="#67E8F9"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />
      <path
        d="M148 420 C156 414 164 416 168 420"
        stroke="#67E8F9"
        strokeWidth="1"
        strokeLinecap="round"
        strokeOpacity="0.45"
      />

      {/* Leaf 2 (smaller companion leaf) */}
      <path
        d="M145 525 C125 475 150 435 202 425 C202 462 182 502 145 525 Z"
        fill="url(#artLeafGrad2)"
        stroke="#14B8A6"
        strokeWidth="0.9"
        strokeOpacity="0.4"
      />
      {/* Central vein for Leaf 2 */}
      <path
        d="M145 525 C162 485 182 455 202 425"
        stroke="#5EEAD4"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />

      {/* Glassy Molar Tooth Body */}
      {/* Translucent glass fill */}
      <path
        d="M260 170 C220 145 170 155 160 215 C150 270 172 335 195 395 C205 422 225 430 240 415 L260 395 L280 415 C295 430 315 422 325 395 C348 335 370 270 360 215 C350 155 300 145 260 170 Z"
        fill="url(#artToothGlass)"
      />

      {/* Inner second outline slightly inset */}
      <path
        d="M260 188 C226 168 184 176 176 225 C168 270 186 325 206 376 C214 397 228 402 240 390 L260 372 L280 390 C292 402 306 397 314 376 C334 325 352 270 344 225 C336 176 294 168 260 188 Z"
        stroke="#22D3EE"
        strokeWidth="1.3"
        strokeOpacity="0.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Bright rim light stroke (2-3px with gaps) */}
      {/* Top left cusp rim */}
      <path
        d="M255 172 C220 148 174 158 162 214 C153 262 170 322 188 370"
        stroke="#F0FDFA"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeOpacity="0.9"
      />
      {/* Top right cusp rim */}
      <path
        d="M265 172 C300 148 346 158 358 214 C366 256 356 305 342 352"
        stroke="#DDD6FE"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.8"
      />
      {/* Left root tip rim */}
      <path
        d="M194 386 C204 416 224 425 238 412"
        stroke="#22D3EE"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Right root tip rim */}
      <path
        d="M326 386 C316 416 296 425 282 412"
        stroke="#7C5CFF"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Root cleft arch */}
      <path
        d="M242 412 L260 395 L278 412"
        stroke="url(#artRimGrad)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.85"
      />

      {/* Soft specular highlight on top-left crown */}
      <path
        d="M184 195 C198 178 226 174 245 178"
        stroke="#FFFFFF"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path
        d="M195 210 C206 198 222 195 236 198"
        stroke="#67E8F9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />

      {/* Smiling curve accent inside the crown */}
      <path
        d="M212 268 C238 304 282 304 308 268"
        stroke="url(#artRimGrad)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeOpacity="0.75"
      />
    </svg>
  )
}

