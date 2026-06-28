import { useEffect, useState } from 'react'
import { Globe, MapPin, Zap, RefreshCw, LogOut, TrendingUp, TrendingDown, Users } from 'lucide-react'
import Logo from '../components/Logo'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000' }
  return               { label: 'Severe',         color: '#8F3F97' }
}

const TABS = [
  { id: 'overview',  icon: Globe,    label: 'Overview'  },
  { id: 'nodes',     icon: MapPin,   label: 'All Nodes' },
  { id: 'anomalies', icon: Zap,      label: 'Anomalies' },
]

export default function AuthorityDashboard({ profile, onSignOut }) {
  const [tab,       setTab]       = useState('overview')
  const [nodes,     setNodes]     = useState([])
  const [anomalies, setAnomalies] = useState([])
  const [userCount, setUserCount] = useState(0)
  const [loading,   setLoading]   = useState(true)

  async function load() {
    setLoading(true)
    try {
      const [n, a, uc] = await Promise.all([api.latestAll(), api.anomalies(), api.userCount()])
      setNodes((n || []).sort((a, b) => (b.aqi || 0) - (a.aqi || 0)))
      setAnomalies(a || [])
      setUserCount(uc?.count || 0)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sorted    = [...nodes].sort((a, b) => (b.aqi || 0) - (a.aqi || 0))
  const cityAvg   = nodes.length ? Math.round(nodes.reduce((s, n) => s + (n.aqi || 0), 0) / nodes.length) : 0
  const chartData = nodes.map(n => ({ name: n.location?.split(' ')[0], AQI: n.aqi || 0, fill: aqiMeta(n.aqi || 0).color }))

  return (
    <div className="flex min-h-screen bg-darkBg text-white">
      <div className="mesh-glow-blue" /><div className="mesh-glow-green" />

      {/* Sidebar */}
      <aside className="relative z-10 flex flex-col w-60 min-h-screen border-r border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="px-5 py-6 border-b border-white/[0.06]"><Logo /></div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-all text-left
                ${tab === id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              <Icon size={17}/>{label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-2 border-t border-white/[0.06] pt-4">
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border text-purple-400 border-purple-400/30 bg-purple-400/10">Authority</span>
          </div>
          <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <LogOut size={17}/> Sign out
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-1">Chennai Municipal Corporation</p>
            <h1 className="text-2xl font-black text-white">Air Quality Authority Dashboard</h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/30">Loading city data…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'City Avg AQI',    value: cityAvg,        meta: aqiMeta(cityAvg), sub: aqiMeta(cityAvg).label },
                    { label: 'Active Nodes',    value: nodes.length,   color: '#00a2ff',       sub: 'monitoring' },
                    { label: 'Registered Users',value: userCount,      color: '#10d343',       sub: 'citizens' },
                    { label: 'Anomalies Today', value: anomalies.length, color: anomalies.length > 0 ? '#FF7E00' : '#00E400', sub: 'detected' },
                  ].map(({ label, value, meta, color, sub }) => (
                    <div key={label} className="glass-card p-5 text-center">
                      <p className="text-xs text-white/40 uppercase tracking-wide mb-2">{label}</p>
                      <p className="text-4xl font-black mb-1" style={{ color: meta?.color || color }}>{value}</p>
                      <p className="text-xs font-semibold" style={{ color: meta?.color || color }}>{sub}</p>
                    </div>
                  ))}
                </div>

                {/* Bar chart */}
                <div className="glass-card p-6">
                  <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">AQI by District</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: '#060913', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white' }} />
                      <Bar dataKey="AQI" radius={[6, 6, 0, 0]}>
                        {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Worst nodes alert */}
                {sorted.slice(0, 2).filter(n => (n.aqi || 0) > 200).map(n => {
                  const m = aqiMeta(n.aqi || 0)
                  return (
                    <div key={n.node_id} className="glass-card p-4 border-l-4 flex items-center gap-4" style={{ borderLeftColor: m.color }}>
                      <Zap size={18} style={{ color: m.color }} />
                      <div>
                        <p className="text-sm font-bold text-white">{n.location} — AQI {n.aqi}</p>
                        <p className="text-xs text-white/50">{m.label} — immediate attention required</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'nodes' && (
              <div className="space-y-3">
                {sorted.map((node, i) => {
                  const m = aqiMeta(node.aqi || 0)
                  return (
                    <div key={node.node_id} className="glass-card p-5 flex items-center gap-4">
                      <div className="w-9 h-9 rounded-btn flex items-center justify-center text-sm font-black" style={{ background: m.color + '20', color: m.color }}>#{i+1}</div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white">{node.location}</p>
                        <p className="text-xs text-white/40">{node.district}, {node.state}</p>
                        <div className="h-1.5 bg-white/10 rounded-full mt-2 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${Math.min((node.aqi||0)/500*100,100)}%`, background: m.color }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-black" style={{ color: m.color }}>{node.aqi||0}</div>
                        <div className="text-xs font-semibold" style={{ color: m.color }}>{m.label}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {tab === 'anomalies' && (
              <div className="space-y-3">
                {anomalies.length === 0 ? (
                  <div className="glass-card p-10 text-center">
                    <Zap size={40} className="text-brandGreen mx-auto mb-3" />
                    <p className="text-white font-semibold">No anomalies detected</p>
                    <p className="text-white/40 text-sm mt-1">AI model has not flagged any unusual readings recently.</p>
                  </div>
                ) : anomalies.map((a, i) => (
                  <div key={i} className="glass-card p-5 flex items-start gap-4 border-l-4 border-orange-500/50">
                    <Zap size={18} className="text-orange-400 mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-white">{a.location}</p>
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Anomaly</span>
                      </div>
                      <p className="text-sm text-white/50">AQI <span className="text-orange-400 font-bold">{a.aqi}</span> flagged as statistically unusual by Isolation Forest AI</p>
                      <p className="text-xs text-white/25 mt-1">{a.recorded_at ? new Date(a.recorded_at).toLocaleString() : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
