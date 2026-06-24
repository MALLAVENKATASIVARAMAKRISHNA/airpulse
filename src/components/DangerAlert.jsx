import { ShieldAlert, X } from 'lucide-react'
import { getHealthMessage } from '../lib/airQuality'

export default function DangerAlert({ reading, node, health, onDismiss }) {
  if (!reading) return null

  return (
    <div className="alert-backdrop" role="alertdialog" aria-modal="true">
      <section className="danger-alert">
        <button className="icon-button dismiss" onClick={onDismiss} aria-label="Dismiss alert">
          <X size={22} />
        </button>
        <div className="danger-icon"><ShieldAlert size={34} /></div>
        <p className="eyebrow">Air quality warning</p>
        <h2>Very unhealthy air detected</h2>
        <div className="alert-aqi">{reading.aqi}<span>AQI</span></div>
        <p className="alert-location">{node?.location}, {node?.district}</p>
        <p>{getHealthMessage(reading.aqi, health?.condition_name, health?.severity_level)}</p>
        <button className="primary-button danger-button" onClick={onDismiss}>
          I understand — dismiss
        </button>
      </section>
    </div>
  )
}
