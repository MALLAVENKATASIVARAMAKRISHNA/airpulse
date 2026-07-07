import { useEffect, useState } from 'react'
import { Globe, MapPin, Zap, RefreshCw, LogOut, ShieldAlert, Users, Activity } from 'lucide-react'
import Logo from '../components/Logo'
import { api } from '../lib/api'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie } from 'recharts'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000' }
  return               { label: 'Severe',         color: '#8F3F97' }
}

const TABS = [
  { id: 'overview',  icon: Globe,    label: 'Overview' },
  { id: 'nodes',     icon: MapPin,   label: 'District Nodes' },
  { id: 'anomalies', icon: Zap,      label: 'Anomalies' },
]

const POLLUTANTS = [
  { key:'pm25',  subAqiKey:'sub_aqi_pm25',  label:'PM2.5', unit:'µg/m³', limit:60,  color:'#EF5350' },
  { key:'pm10',  subAqiKey:'sub_aqi_pm10',  label:'PM10',  unit:'µg/m³', limit:100, color:'#FF7043' },
  { key:'no2',   subAqiKey:'sub_aqi_no2',   label:'NO2',   unit:'µg/m³', limit:80,  color:'#AB47BC' },
  { key:'ozone', subAqiKey:'sub_aqi_ozone', label:'Ozone', unit:'µg/m³', limit:100, color:'#26A69A' },
  { key:'co',    subAqiKey:'sub_aqi_co',    label:'CO',    unit:'mg/m³',  limit:10,  color:'#FFA726' },
  { key:'nh3',   subAqiKey:'sub_aqi_nh3',   label:'NH3',   unit:'µg/m³', limit:400, color:'#FFCA28' },
]

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}

export default function AuthorityDashboard({ profile, onSignOut }) {
  const [tab,       setTab]       = useState('overview')
  const [rawNodes,  setRawNodes]  = useState([])
  const [rawAnomalies, setRawAnomalies] = useState([])
  const [userCount, setUserCount] = useState(0)
  const [loading,   setLoading]   = useState(true)

  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeReadings, setNodeReadings] = useState([])
  const [nodeLoading,  setNodeLoading]  = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [n, a, uc] = await Promise.all([api.latestAll(), api.anomalies(), api.userCount()])
      setRawNodes(n || [])
      setRawAnomalies(a || [])
      setUserCount(uc?.count || 0)
    } catch {}
    setLoading(false)
  }

  const selectNodeDetail = async (node) => {
    setSelectedNode(node)
    setNodeLoading(true)
    try {
      const res = await api.nodeReadings(node.node_id)
      setNodeReadings((res || []).slice(0, 24).reverse())
    } catch {}
    setNodeLoading(false)
  }

  useEffect(() => { load() }, [])

  // Filter nodes & anomalies by authority's state and district jurisdiction
  const nodes = rawNodes.filter(n => 
    (!profile.district || n.district?.toLowerCase() === profile.district?.toLowerCase()) &&
    (!profile.state || n.state?.toLowerCase() === profile.state?.toLowerCase())
  )

  const anomalies = rawAnomalies.filter(a => 
    (!profile.district || a.district?.toLowerCase() === profile.district?.toLowerCase()) &&
    (!profile.state || a.state?.toLowerCase() === profile.state?.toLowerCase())
  )

  const sorted    = [...nodes].sort((a, b) => (b.aqi || 0) - (a.aqi || 0))
  const districtAvg = nodes.length ? Math.round(nodes.reduce((s, n) => s + (n.aqi || 0), 0) / nodes.length) : 0
  const chartData = nodes.map(n => ({ name: n.location?.split(' ')[0], AQI: n.aqi || 0, fill: aqiMeta(n.aqi || 0).color }))

  // CPCB Standard safe limit is AQI <= 100. Any node with AQI > 100 exceeds CPCB guidelines.
  const cpcbExceededNodes = nodes.filter(n => (n.aqi || 0) > 100)

  return (
    <div className="flex min-h-screen bg-darkBg text-white">
      <div className="mesh-glow-blue" /><div className="mesh-glow-green" />

      {/* Sidebar */}
      <aside className="relative z-10 flex flex-col w-60 min-h-screen border-r border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="px-5 py-6 border-b border-white/[0.06]"><Logo /></div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setTab(id); setSelectedNode(null); setNodeReadings([]) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-all text-left
                ${tab === id ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-white/50 hover:text-white hover:bg-white/5'}`}>
              <Icon size={17}/>{label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-5 space-y-2 border-t border-white/[0.06] pt-4">
          <div className="px-3 py-1.5 flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border text-purple-400 border-purple-400/30 bg-purple-400/10 w-max">
              Authority
            </span>
            <p className="text-[10px] text-white/40 truncate font-semibold">
              📍 {profile.district || 'All Districts'}, {profile.state || 'All States'}
            </p>
          </div>
          <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all">
            <LogOut size={17}/> Sign out
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 overflow-y-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold mb-1">
              {profile.district || 'National'} Jurisdiction
            </p>
            <h1 className="text-2xl font-black text-white">Air Quality Authority Dashboard</h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40 text-white/30">Loading jurisdiction data…</div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: 'District Avg AQI', value: districtAvg,        meta: aqiMeta(districtAvg), sub: aqiMeta(districtAvg).label },
                    { label: 'Active Nodes',    value: nodes.length,   color: '#00a2ff',       sub: 'assigned nodes' },
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

                {/* CPCB Exceeded Warnings Alert Panel */}
                {cpcbExceededNodes.length > 0 ? (
                  <div className="glass-card p-5 border-l-4 border-red-500/70 bg-red-500/[0.02] space-y-3">
                    <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                      <ShieldAlert size={16} /> CPCB Warning Alert: {cpcbExceededNodes.length} Node(s) Exceeding Safe Limits (AQI &gt; 100)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {cpcbExceededNodes.map(n => {
                        const meta = aqiMeta(n.aqi || 0)
                        return (
                          <div key={n.node_id} onClick={() => { setTab('nodes'); selectNodeDetail(n) }}
                            className="bg-white/[0.03] border border-white/5 rounded-btn p-3 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-all">
                            <div>
                              <p className="text-xs font-bold text-white">{n.location}</p>
                              <p className="text-[10px] text-white/30 mt-0.5">{n.node_id} · {n.district}</p>
                            </div>
                            <div className="text-right flex flex-col items-end">
                              <span className="text-sm font-black" style={{ color: meta.color }}>AQI {n.aqi}</span>
                              <span className="text-[9px] font-bold block uppercase tracking-wider mt-0.5 px-2 py-0.5 rounded-full" style={{ color: meta.color, background: meta.color+'15' }}>
                                {meta.label}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="glass-card p-4 border-l-4 border-green-500/60 bg-green-500/[0.01] flex items-center gap-2.5 text-xs text-green-400 font-semibold">
                    ✅ All nodes in your jurisdiction are within safe CPCB AQI guidelines (AQI &le; 100).
                  </div>
                )}

                {/* Bar chart */}
                {nodes.length > 0 ? (
                  <div className="glass-card p-6">
                    <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">AQI by Monitoring Node</p>
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
                ) : (
                  <div className="glass-card p-10 text-center text-white/20 text-sm">No monitoring nodes assigned to your district.</div>
                )}
              </div>
            )}

            {tab === 'nodes' && (
              selectedNode ? (
                /* Detailed Node View Sub-tab (Matches Citizen View) */
                <div className="space-y-6">
                  {/* Header / Back */}
                  <div className="flex items-center justify-between">
                    <button onClick={() => { setSelectedNode(null); setNodeReadings([]) }}
                      className="text-xs text-brandCyan hover:text-white flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-btn transition-all">
                      ← Back to District Nodes List
                    </button>
                    <h2 className="text-sm font-bold text-white/55">{selectedNode.node_id} Details</h2>
                  </div>

                  {/* Title / Summary */}
                  {(() => {
                    const meta = aqiMeta(selectedNode.aqi || 0)
                    const trendData = nodeReadings.map(r => ({
                      time: formatTime(r.recorded_at),
                      aqi: r.aqi || 0
                    }))

                    return (
                      <>
                        <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-6"
                          style={{ background: `radial-gradient(circle at center, ${meta.color}08 0%, rgba(255,255,255,0.03) 100%)` }}>
                          <div className="flex-1">
                            <h1 className="text-2xl font-black text-white">{selectedNode.location}</h1>
                            <p className="text-xs text-white/40 mt-1">{selectedNode.district}, {selectedNode.state}</p>
                            <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-btn inline-block">
                              <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Cause of Pollution</span>
                              <span className="text-xs text-white/80 font-medium">
                                {selectedNode.cause || 'Automobile emissions & industrial output'}
                              </span>
                            </div>
                          </div>

                          {/* Gauge */}
                          <div className="text-center md:text-right flex-shrink-0">
                            <div className="text-5xl font-black mb-1" style={{ color: meta.color }}>
                              {selectedNode.aqi || 0}
                            </div>
                            <div className="text-sm font-semibold uppercase tracking-wide" style={{ color: meta.color }}>
                              {meta.label}
                            </div>
                            <span className="text-[10px] text-white/30 block mt-1">CPCB Indian AQI Index</span>
                          </div>
                        </div>

                        {nodeLoading && nodeReadings.length === 0 ? (
                          <div className="text-center text-white/30 py-10">Loading node metrics…</div>
                        ) : (
                          <>
                            {/* Charts Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Trend chart */}
                              {trendData.length > 0 && (
                                <div className="glass-card p-5 flex flex-col justify-between">
                                  <p className="text-xs text-white/40 uppercase tracking-wide mb-4">24h AQI Trend</p>
                                  <ResponsiveContainer width="100%" height={160}>
                                    <AreaChart data={trendData} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                                      <defs>
                                        <linearGradient id="auth-node-aqi-grad" x1="0" y1="0" x2="0" y2="1">
                                          <stop offset="5%" stopColor={meta.color} stopOpacity={0.3}/>
                                          <stop offset="95%" stopColor={meta.color} stopOpacity={0}/>
                                        </linearGradient>
                                      </defs>
                                      <XAxis dataKey="time" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:10 }} axisLine={false} tickLine={false} interval={4}/>
                                      <YAxis tick={{ fill:'rgba(255,255,255,0.3)', fontSize:10 }} axisLine={false} tickLine={false}/>
                                      <Tooltip contentStyle={{ background:'#060913', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'white' }}/>
                                      <Area type="monotone" dataKey="aqi" stroke={meta.color} strokeWidth={2} fill="url(#auth-node-aqi-grad)" dot={false}/>
                                    </AreaChart>
                                  </ResponsiveContainer>
                                </div>
                              )}

                              {/* Composition Pie Chart */}
                              <div className="glass-card p-5 flex flex-col justify-between">
                                <p className="text-xs text-white/40 uppercase tracking-wide mb-4">Pollutant Mass Share</p>
                                <div className="flex items-center justify-between gap-4 flex-1">
                                  <div className="w-[180px] h-[150px] flex-shrink-0">
                                    <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                        <Pie
                                          data={POLLUTANTS.map(({ label, key, color }) => ({
                                            name: label,
                                            value: selectedNode?.[key] || 0,
                                            color: color
                                          })).filter(x => x.value > 0)}
                                          cx="50%"
                                          cy="50%"
                                          innerRadius={30}
                                          outerRadius={50}
                                          paddingAngle={3}
                                          dataKey="value"
                                        >
                                          {POLLUTANTS.map(({ label, key, color }) => {
                                            const val = selectedNode?.[key] || 0
                                            if (val === 0) return null
                                            return <Cell key={label} fill={color} />
                                          })}
                                        </Pie>
                                        <Tooltip contentStyle={{ background:'#060913', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'white' }}/>
                                      </PieChart>
                                    </ResponsiveContainer>
                                  </div>
                                  <div className="flex-1 grid grid-cols-2 gap-x-2 gap-y-1.5 pl-2 max-w-[200px]">
                                    {POLLUTANTS.map(({ label, key, unit, color }) => {
                                      const val = selectedNode?.[key] || 0
                                      if (val === 0) return null
                                      return (
                                        <div key={label} className="flex items-center gap-1.5 text-[10px]">
                                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
                                          <span className="text-white/60 font-semibold truncate">{label}:</span>
                                          <span className="text-white/80 font-bold truncate">{val.toFixed(1)} {unit}</span>
                                        </div>
                                      )
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Detailed metrics grid */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                              {POLLUTANTS.map(({ key, subAqiKey, label, unit, limit, color }) => {
                                const val = selectedNode?.[key] || 0
                                const subAqi = selectedNode?.[subAqiKey] || 0
                                const valPct = Math.min((val / limit) * 100, 100)
                                const status = valPct>=100?'Exceeds Limit':valPct>=80?'High':valPct>=50?'Moderate':'Safe'
                                const statusColor = valPct>=100?'#FF0000':valPct>=80?'#FF7E00':valPct>=50?'#FFFF00':'#00E400'
                                return (
                                  <div key={key} className="glass-card p-5" style={{ borderColor: color+'20' }}>
                                    <div className="flex items-center justify-between mb-3">
                                      <span className="text-sm font-bold text-white">{label}</span>
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: statusColor, background: statusColor+'15' }}>
                                        {status}
                                      </span>
                                    </div>
                                    <div className="text-3xl font-black mb-1" style={{ color }}>
                                      {val.toFixed(1)} <span className="text-xs text-white/30 font-medium">{unit}</span>
                                    </div>
                                    <div className="text-xs text-white/40 mb-3">
                                      Sub-AQI: <span className="font-semibold text-white/70">{subAqi}</span>
                                      <span className="text-white/20"> / limit {limit}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                      <div className="h-full rounded-full" style={{ width:`${valPct}%`, background: color }} />
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </>
                    )
                  })()}
                </div>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  {sorted.length > 0 ? (
                    sorted.map((node, i) => {
                      const m = aqiMeta(node.aqi || 0)
                      return (
                        <div key={node.node_id} onClick={() => selectNodeDetail(node)}
                          className="glass-card p-5 flex items-center gap-4 cursor-pointer hover:border-brandCyan/40 active:scale-[0.99] transition-all">
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
                    })
                  ) : (
                    <div className="glass-card p-10 text-center text-white/30">No nodes found in your assigned district.</div>
                  )}
                </div>
              )
            )}

            {tab === 'anomalies' && (
              <div className="space-y-3">
                {anomalies.length === 0 ? (
                  <div className="glass-card p-10 text-center">
                    <Zap size={40} className="text-brandGreen mx-auto mb-3" />
                    <p className="text-white font-semibold">No anomalies detected</p>
                    <p className="text-white/40 text-sm mt-1">AI model has not flagged any unusual readings recently in your district.</p>
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
