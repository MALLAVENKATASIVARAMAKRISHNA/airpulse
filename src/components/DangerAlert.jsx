import { ShieldAlert, X } from 'lucide-react'
import { getHealthMessage, getAuthorityDirectives } from '../lib/airQuality'

export default function DangerAlert({ reading, node, health, role = 'user', onDismiss }) {
  if (!reading) return null

  const isAuth = role === 'authority'

  return (
    <div className="alert-backdrop" role="alertdialog" aria-modal="true">
      <section className="danger-alert">
        <button className="icon-button dismiss" onClick={onDismiss} aria-label="Dismiss alert">
          <X size={22} />
        </button>
        <div className="danger-icon"><ShieldAlert size={34} /></div>
        <p className="eyebrow">{isAuth ? 'Government Action Alert' : 'Air quality warning'}</p>
        <h2>{isAuth ? 'Municipal Intervention Required' : 'Very unhealthy air detected'}</h2>
        <div className="alert-aqi">{reading.aqi}<span>AQI</span></div>
        <p className="alert-location">{node?.location}, {node?.district}</p>
        <p>
          {isAuth
            ? getAuthorityDirectives(reading.aqi)
            : getHealthMessage(reading.aqi, health?.condition_name, health?.severity_level)
          }
        </p>
        <button className="primary-button danger-button" onClick={onDismiss}>
          {isAuth ? 'Acknowledged' : 'I understand — dismiss'}
        </button>
      </section>
    </div>
  )
}
