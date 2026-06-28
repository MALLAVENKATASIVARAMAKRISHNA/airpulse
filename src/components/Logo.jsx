export default function Logo({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-9 h-9 flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_12px_rgba(0,106,255,0.5)]">
          <defs>
            <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#006aff" />
              <stop offset="100%" stopColor="#10d343" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#logo-grad)" />
          <path
            d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
            stroke="white" strokeWidth="7" strokeLinecap="round"
            strokeLinejoin="round" fill="none"
          />
        </svg>
      </div>
      {!compact && (
        <div className="flex flex-col leading-none">
          <span className="text-lg font-black tracking-tight">
            <span className="text-white">air</span>
            <span className="brand-text">pulse</span>
          </span>
          <span className="text-[10px] text-white/40 tracking-widest uppercase mt-0.5">AI Monitor</span>
        </div>
      )}
    </div>
  )
}
