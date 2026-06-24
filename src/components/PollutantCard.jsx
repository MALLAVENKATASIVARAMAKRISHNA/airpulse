export default function PollutantCard({ label, value, unit, subAqi }) {
  return (
    <article className="pollutant-card">
      <div className="pollutant-top">
        <span>{label}</span>
        {subAqi != null && <small>Sub-AQI {subAqi}</small>}
      </div>
      <strong>{value ?? '—'}</strong>
      <span className="unit">{unit}</span>
      <div className="mini-track">
        <span style={{ width: `${Math.min(((subAqi || 0) / 300) * 100, 100)}%` }} />
      </div>
    </article>
  )
}
