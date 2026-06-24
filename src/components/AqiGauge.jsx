import { getAqiMeta } from '../lib/airQuality'

export default function AqiGauge({ value = 0, compact = false }) {
  const meta = getAqiMeta(value)
  const degrees = Math.min((value / 500) * 270, 270)

  return (
    <div className={`aqi-gauge ${compact ? 'compact' : ''}`}>
      <div
        className="gauge-ring"
        style={{
          background: `conic-gradient(from 225deg, ${meta.color} 0deg ${degrees}deg, rgba(255,255,255,.09) ${degrees}deg 270deg, transparent 270deg)`,
        }}
      >
        <div className="gauge-center">
          <strong>{value ?? '—'}</strong>
          <span>AQI</span>
        </div>
      </div>
      <div className="aqi-label" style={{ color: meta.color }}>
        <span style={{ background: meta.color }} />
        {meta.label}
      </div>
    </div>
  )
}
