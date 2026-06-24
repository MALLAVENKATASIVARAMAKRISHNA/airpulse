import { Wind } from 'lucide-react'

export default function Logo({ compact = false }) {
  return (
    <div className="logo">
      <span className="logo-mark"><Wind size={22} /></span>
      {!compact && (
        <span>
          <strong>AirPulse</strong>
          <small>AI Monitor</small>
        </span>
      )}
    </div>
  )
}
