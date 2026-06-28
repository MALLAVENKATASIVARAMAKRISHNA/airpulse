import { useEffect, useState } from 'react'
import { Brain, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

const SOURCE_ICONS = {
  'Vehicle Traffic': '🚗', 'Diesel Exhaust': '🚛', 'Industrial Emissions': '🏭',
  'Construction Dust': '🏗️', 'Agricultural Burning': '🌾', 'Waste Burning': '🔥',
  'Natural Dust': '💨', 'Photochemical Smog': '☀️', 'Default': '🌫️'
}

function getSourceIcon(cause) {
  const c = (cause || '').toLowerCase()
  if (c.includes('vehicle') || c.includes('traffic')) return SOURCE_ICONS['Vehicle Traffic']
  if (c.includes('diesel'))                            return SOURCE_ICONS['Diesel Exhaust']
  if (c.includes('industri'))                         return SOURCE_ICONS['Industrial Emissions']
  if (c.includes('construct') || c.includes('dust'))  return SOURCE_ICONS['Construction Dust']
  if (c.includes('agricult') || c.includes('burn'))   return SOURCE_ICONS['Agricultural Burning']
  if (c.includes('waste'))                             return SOURCE_ICONS['Waste Burning']
  if (c.includes('ozone') || c.includes('photo'))     return SOURCE_ICONS['Photochemical Smog']
  return SOURCE_ICONS['Default']
}

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000' }
  return               { label: 'Severe',         color: '#8F3F97' }
}

const POLLUTANTS = [
  { key: 'pm25',  label: 'PM2.5',  unit: 'µg/m³', limit: 60  },
  { key: 'pm10',  label: 'PM10',   unit: 'µg/m³', limit: 100 },
  { key: 'no2',   label: 'NO2',    unit: 'µg/m³', limit: 80  },
  { key: 'co',    label: 'CO',     unit: 'mg/m³',  limit: 10  },
  { key: 'ozone', label: 'Ozone',  unit: 'µg/m³', limit: 100 },
  { key: 'nh3',   label: 'NH3',    unit: 'µg/m³', limit: 400 },
]

export default function SourceAnalysisPage({ profile }) {
  const [reading,  setReading]  = useState(null)
  const [history,  setHistory]  = useState([])
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [nodes, hist] = await Promise.all([api.latestAll(), api.nodeReadings(profile.node_id)])
      setReading((nodes || []).find(n => n.node_id === profile.node_id) || null)
      setHistory((hist || []).filter(r => r.cause).slice(0, 10))
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [profile.node_id])

  if (loading) return <div className="p-8 flex items-center justify-center h-40 text-white/30">Loading…</div>

  const meta = reading ? aqiMeta(reading.aqi || 0) : null

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Brain size={22} className="text-brandCyan" /> Source Analysis
          </h1>
          <p className="text-white/40 text-sm mt-1">AI-detected pollution causes for {reading?.location || 'your node'}</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {reading && (
        <>
          {/* Current cause */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">{getSourceIcon(reading.cause)}</div>
              <div className="flex-1">
                <p className="text-xs text-white/40 uppercase tracking-wide mb-1">Dominant cause right now</p>
                <p className="text-lg font-bold text-white mb-1">{reading.cause || 'Not analysed yet'}</p>
                <p className="text-sm text-white/40">Dominant pollutant: <span className="font-semibold" style={{ color: meta?.color }}>{reading.dominant_pollutant || '—'}</span></p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-black" style={{ color: meta?.color }}>{reading.aqi || 0}</div>
                <div className="text-xs font-semibold" style={{ color: meta?.color }}>{meta?.label}</div>
              </div>
            </div>
          </div>

          {/* Pollutant breakdown */}
          <div className="glass-card p-6 mb-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Pollutant Breakdown</p>
            <div className="space-y-4">
              {POLLUTANTS.map(({ key, label, unit, limit }) => {
                const val = reading[key] || 0
                const pct = Math.min((val / limit) * 100, 100)
                const color = pct >= 100 ? '#FF0000' : pct >= 80 ? '#FF7E00' : pct >= 50 ? '#FFFF00' : '#00E400'
                return (
                  <div key={key}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-semibold text-white">{label}</span>
                      <span className="text-white/50">{val.toFixed(1)} {unit} <span className="text-white/25">/ {limit}</span></span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Recent cause history */}
          {history.length > 0 && (
            <div className="glass-card p-6">
              <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Recent Cause History</p>
              <div className="space-y-2">
                {history.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5">
                    <span className="text-xl">{getSourceIcon(r.cause)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{r.cause}</p>
                      <p className="text-xs text-white/30">{r.recorded_at ? new Date(r.recorded_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                    </div>
                    <span className="text-sm font-bold text-white/60">AQI {r.aqi}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
