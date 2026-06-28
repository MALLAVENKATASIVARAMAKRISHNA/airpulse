import { useEffect, useState } from 'react'
import { MapPin, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000' }
  return               { label: 'Severe',         color: '#8F3F97' }
}

export default function HotspotPage({ profile }) {
  const [nodes,    setNodes]    = useState([])
  const [clusters, setClusters] = useState([])
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [n, c] = await Promise.all([api.latestAll(), api.hotspots()])
      setNodes((n || []).sort((a, b) => (b.aqi || 0) - (a.aqi || 0)))
      setClusters(c || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function clusterFor(node_id) {
    return clusters.find(c => c.node_ids?.includes(node_id))
  }

  const cityAvg = nodes.length ? Math.round(nodes.reduce((s, n) => s + (n.aqi || 0), 0) / nodes.length) : 0
  const worst   = nodes[0]
  const best    = nodes[nodes.length - 1]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MapPin size={22} className="text-brandCyan" /> Pollution Hotspots
          </h1>
          <p className="text-white/40 text-sm mt-1">All Chennai monitoring nodes ranked by AQI · auto-updates every 30s</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading nodes…</div>
      ) : (
        <>
          {/* City summary */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'City Average AQI', value: cityAvg, meta: aqiMeta(cityAvg) },
              { label: 'Worst Node',       value: worst?.aqi || 0, sub: worst?.location, meta: aqiMeta(worst?.aqi || 0), icon: <TrendingUp size={14}/> },
              { label: 'Best Node',        value: best?.aqi  || 0, sub: best?.location,  meta: aqiMeta(best?.aqi  || 0), icon: <TrendingDown size={14}/> },
            ].map(({ label, value, sub, meta, icon }) => (
              <div key={label} className="glass-card p-5 text-center">
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">{label}</p>
                <div className="text-4xl font-black mb-1" style={{ color: meta.color }}>{value}</div>
                <div className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</div>
                {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Node list */}
          <div className="space-y-3">
            {nodes.map((node, i) => {
              const meta    = aqiMeta(node.aqi || 0)
              const isUser  = node.node_id === profile.node_id
              const cluster = clusterFor(node.node_id)
              const pct     = Math.min((node.aqi || 0) / 500 * 100, 100)

              return (
                <div key={node.node_id} className={`glass-card p-5 flex items-center gap-4 ${isUser ? 'border-brandCyan/30' : ''}`}
                  style={isUser ? { borderColor: 'rgba(0,162,255,0.3)' } : {}}>
                  {/* Rank */}
                  <div className="w-9 h-9 rounded-btn flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: meta.color + '30', color: meta.color }}>
                    #{i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold text-white">{node.location}</span>
                      {isUser && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brandCyan/20 text-brandCyan border border-brandCyan/30">Your location</span>}
                      {cluster && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">{cluster.label}</span>}
                    </div>
                    <p className="text-xs text-white/40 mb-2">{node.district}, {node.state}</p>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                    <div className="flex gap-4 mt-2">
                      {[['PM2.5', node.pm25], ['PM10', node.pm10], ['NO2', node.no2]].map(([l, v]) => (
                        <span key={l} className="text-[11px] text-white/40"><span className="text-white/60 font-semibold">{l}</span> {v ? v.toFixed(0) : '—'}</span>
                      ))}
                    </div>
                  </div>

                  {/* AQI */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ color: meta.color }}>{node.aqi || 0}</div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
