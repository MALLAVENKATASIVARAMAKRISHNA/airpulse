import { useEffect, useState } from 'react'
import { TrendingUp, Clock, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400', bg: 'rgba(0,228,0,0.1)' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442', bg: 'rgba(118,196,66,0.1)' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00', bg: 'rgba(255,255,0,0.1)' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00', bg: 'rgba(255,126,0,0.1)' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000', bg: 'rgba(255,0,0,0.1)' }
  return               { label: 'Severe',         color: '#8F3F97', bg: 'rgba(143,63,151,0.1)' }
}

export default function ForecastPage({ profile }) {
  const [preds,    setPreds]    = useState([])
  const [readings, setReadings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [lastUpdated, setLastUpdated] = useState(null)

  async function load() {
    setLoading(true)
    try {
      const [p, r] = await Promise.all([
        api.predictions(profile.node_id),
        api.nodeReadings(profile.node_id),
      ])
      setPreds(p || [])
      setReadings((r || []).slice(0, 12).reverse())
      setLastUpdated(new Date())
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [profile.node_id])

  const HORIZONS = ['6h', '24h', '48h']

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-brandCyan" /> AQI Forecast
          </h1>
          <p className="text-white/40 text-sm mt-1">AI-powered predictions for your node · CatBoost model</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading forecasts…</div>
      ) : preds.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <TrendingUp size={40} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No forecast data yet.</p>
          <p className="text-white/30 text-xs mt-1">Run the Colab ML notebook to generate predictions.</p>
        </div>
      ) : (
        <>
          {/* Horizon cards */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {HORIZONS.map(h => {
              const p    = preds.find(x => x.horizon === h)
              const meta = p ? aqiMeta(p.predicted_aqi) : null
              return (
                <div key={h} className="glass-card p-6 text-center" style={meta ? { borderColor: meta.color + '30' } : {}}>
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <Clock size={13} className="text-white/40" />
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{h} ahead</span>
                  </div>
                  {p ? (
                    <>
                      <div className="text-5xl font-black mb-1" style={{ color: meta.color }}>{p.predicted_aqi}</div>
                      <div className="text-xs font-semibold px-2 py-1 rounded-full inline-block" style={{ color: meta.color, background: meta.bg }}>{meta.label}</div>
                      <p className="text-xs text-white/30 mt-3">
                        {p.predicted_for ? new Date(p.predicted_for).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </>
                  ) : (
                    <div className="text-3xl font-black text-white/20">—</div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Recent readings trend */}
          {readings.length > 0 && (
            <div className="glass-card p-6">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4">Recent Readings (basis for forecast)</h3>
              <div className="flex items-end gap-1 h-24">
                {readings.map((r, i) => {
                  const meta = aqiMeta(r.aqi || 0)
                  const h    = Math.max(8, Math.min(96, ((r.aqi || 0) / 500) * 96))
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] bg-white/10 px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap">
                        {r.aqi}
                      </div>
                      <div className="w-full rounded-t" style={{ height: `${h}px`, backgroundColor: meta.color, opacity: 0.8 }} />
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-between text-[10px] text-white/25 mt-1">
                <span>Oldest</span><span>Latest</span>
              </div>
            </div>
          )}
        </>
      )}

      {lastUpdated && (
        <p className="text-xs text-white/20 text-right mt-4">Last updated {lastUpdated.toLocaleTimeString()}</p>
      )}
    </div>
  )
}
