export default function LoadingScreen() {
  return (
    <div className="min-h-screen bg-darkBg flex flex-col items-center justify-center gap-6">
      <div className="mesh-glow-blue" />
      <div className="mesh-glow-green" />
      <div className="relative z-10 w-16 h-16">
        <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(0,106,255,0.5)] animate-pulse">
          <defs>
            <linearGradient id="loading-logo" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#006aff" />
              <stop offset="100%" stopColor="#10d343" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="48" fill="url(#loading-logo)" />
          <path d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
            stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
      <div className="relative z-10 flex gap-1.5">
        {[0,1,2].map(i => (
          <div key={i} className="w-1.5 h-1.5 rounded-full bg-brandCyan animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />
        ))}
      </div>
    </div>
  )
}
