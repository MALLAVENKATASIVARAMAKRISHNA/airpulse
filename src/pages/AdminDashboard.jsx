import { useCallback, useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, PieChart, Pie } from 'recharts'
import { Activity, Check, MapPin, Pause, Play, Plus, RefreshCw, Search, Shield, Users, Zap, Globe, Pencil } from 'lucide-react'
import AppShell from '../components/AppShell'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label:'Good',        color:'#00E400' }
  if (aqi <= 100) return { label:'Satisfactory', color:'#76C442' }
  if (aqi <= 200) return { label:'Moderate',     color:'#FFFF00' }
  if (aqi <= 300) return { label:'Poor',         color:'#FF7E00' }
  if (aqi <= 400) return { label:'Very Poor',    color:'#FF0000' }
  return               { label:'Severe',         color:'#8F3F97' }
}

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

export default function AdminDashboard({ profile, onSignOut, theme, toggleTheme }) {
  const [tab,       setTab]       = useState('overview')
  const [nodes,     setNodes]     = useState([])
  const [users,     setUsers]     = useState([])
  const [userCount, setUserCount] = useState(0)
  const [anomalies, setAnomalies] = useState([])
  const [simStatus, setSimStatus] = useState(null)
  const SIM_INTERVAL = 5
  const [simLog,    setSimLog]    = useState([])
  const [overrides, setOverrides] = useState({})
  const [simMode,   setSimMode]   = useState('now')
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [live,      setLive]      = useState(false)

  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeReadings, setNodeReadings] = useState([])
  const [nodePredictions, setNodePredictions] = useState([])
  const [nodeLoading,  setNodeLoading]  = useState(false)

  const [userSubTab, setUserSubTab] = useState('users') // 'users' or 'authority'
  const [showAddAuth, setShowAddAuth] = useState(false)
  const [authForm, setAuthForm] = useState({ fullName: '', email: '', phone: '', state: '', district: '' })
  const [error, setError] = useState('')

  const [editingUser, setEditingUser] = useState(null)

  const [showAddNode, setShowAddNode] = useState(false)
  const [nodeForm, setNodeForm] = useState({
    node_id: '',
    location: '',
    district: '',
    state: '',
    pincode: '',
    latitude: '',
    longitude: '',
    zone_type: 'Residential',
    near_highway: false,
    near_factory: false,
    near_construction: false,
    population_density: '50',
    green_cover_percentage: '20'
  })
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ fullName: '', email: '', phone: '', nodeId: '', state: '', district: '' })

  const load = useCallback(async () => {
    try {
      const [n, uc, s, a] = await Promise.all([api.latestAll(), api.userCount(), api.simStatus(), api.anomalies()])
      setNodes(n||[])
      setUserCount(uc?.count||0)
      setSimStatus(s)
      if (s?.mode) setSimMode(s.mode)
      setAnomalies(a||[])
    } catch {}
    setLoading(false)
  }, [])

  const loadUsers = useCallback(async () => {
    try { setUsers(await api.users()||[]) } catch {}
  }, [])

  async function handleAddAuthority(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.createAuthority({
        full_name: authForm.fullName,
        email: authForm.email,
        phone_number: authForm.phone,
        state: authForm.state,
        district: authForm.district
      })
      setShowAddAuth(false)
      setAuthForm({ fullName: '', email: '', phone: '', state: '', district: '' })
      await loadUsers()
    } catch(err) {
      alert(err.message || 'Failed to create authority.')
    }
    setLoading(false)
  }

  async function handleAddNode(e) {
    e.preventDefault()
    setLoading(true)
    try {
      await api.createNode({
        node_id: nodeForm.node_id,
        location: nodeForm.location,
        district: nodeForm.district,
        state: nodeForm.state,
        pincode: nodeForm.pincode,
        latitude: parseFloat(nodeForm.latitude) || 0.0,
        longitude: parseFloat(nodeForm.longitude) || 0.0,
        zone_type: nodeForm.zone_type,
        near_highway: nodeForm.near_highway,
        near_factory: nodeForm.near_factory,
        near_construction: nodeForm.near_construction,
        population_density: parseInt(nodeForm.population_density) || 50,
        green_cover_percentage: parseFloat(nodeForm.green_cover_percentage) || 20.0
      })
      setShowAddNode(false)
      setNodeForm({
        node_id: '', location: '', district: '', state: '', pincode: '',
        latitude: '', longitude: '', zone_type: 'Residential',
        near_highway: false, near_factory: false, near_construction: false,
        population_density: '50', green_cover_percentage: '20'
      })
      const n = await api.latestAll()
      setNodes(n || [])
    } catch(err) {
      alert(err.message || 'Failed to register node.')
    }
    setLoading(false)
  }

  const handleEditClick = (user) => {
    setEditingUser(user)
    setEditForm({
      fullName: user.full_name || '',
      email: user.email || '',
      phone: user.phone_number || '',
      nodeId: user.node_id || '',
      state: user.state || '',
      district: user.district || ''
    })
    setShowEditModal(true)
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.adminUpdateUser(editingUser.user_id, {
        full_name: editForm.fullName,
        email: editForm.email,
        phone_number: editForm.phone,
        node_id: editingUser.role === 'user' ? editForm.nodeId : null,
        state: editingUser.role === 'authority' ? editForm.state : null,
        district: editingUser.role === 'authority' ? editForm.district : null
      })
      setShowEditModal(false)
      setEditingUser(null)
      await loadUsers()
    } catch (err) {
      alert(err.message || 'Failed to update user profile.')
    }
    setLoading(false)
  }

  const selectNodeDetail = async (node) => {
    setSelectedNode(node)
    setNodeLoading(true)
    try {
      const [hist, preds] = await Promise.all([
        api.nodeReadings(node.node_id),
        api.predictions(node.node_id)
      ])
      setNodeReadings((hist || []).slice(0, 24).reverse())
      setNodePredictions(preds || [])
    } catch {}
    setNodeLoading(false)
  }

  useEffect(() => {
    load()
    const intervalTime = live ? 15000 : 2000
    const id = setInterval(load, intervalTime)
    return () => clearInterval(id)
  }, [load, live])

  // MQTT — real-time updates from IoT Core for all nodes
  useEffect(() => {
    let client
    api.getIotUrl().then(({ url }) => {
      client = mqtt.connect(url, { clientId: `admin-${Date.now()}` })
      client.on('connect', () => { client.subscribe('airpulse/readings/#'); setLive(true) })
      client.on('message', (_, message) => {
        try {
          const data = JSON.parse(message.toString())
          setNodes(prev => prev.map(n => n.node_id === data.node_id ? { ...n, ...data } : n))
          setSelectedNode(prev => prev && prev.node_id === data.node_id ? { ...prev, ...data } : prev)
        } catch {}
      })
      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})
    return () => { client?.end(true); setLive(false) }
  }, [])

  useEffect(() => { if (tab==='users') loadUsers() }, [tab, loadUsers])

  async function startSim()  { try { await api.simStart(SIM_INTERVAL, simMode); await load(); setSimLog(l=>[`▶ Simulation started (${SIM_INTERVAL}s interval, mode: ${simMode})`,...l.slice(0,49)]) } catch(e){setSimLog(l=>[`✗ ${e.message}`,...l.slice(0,49)])} }
  async function stopSim()   { try { await api.simStop();              await load(); setSimLog(l=>['⏹ Simulation stopped',...l.slice(0,49)]) } catch(e){setSimLog(l=>[`✗ ${e.message}`,...l.slice(0,49)])} }

  async function insertReading(node_id, location) {
    const ov = overrides[node_id] || {}
    if (!ov.aqi) return setSimLog(l=>['✗ AQI is required',...l.slice(0,49)])
    try {
      await api.insertReading({
        node_id,
        aqi:   parseInt(ov.aqi)   || 0,
        pm25:  parseFloat(ov.pm25)  || 0,
        pm10:  parseFloat(ov.pm10)  || 0,
        co:    parseFloat(ov.co)    || 0,
        nh3:   parseFloat(ov.nh3)   || 0,
        no2:   parseFloat(ov.no2)   || 0,
        ozone: parseFloat(ov.ozone) || 0,
      })
      setSimLog(l=>[`✓ Reading inserted for ${location} → AQI ${ov.aqi}`,...l.slice(0,49)])
      setOverrides(p => ({ ...p, [node_id]: {} }))
      await load()
    } catch(e) { setSimLog(l=>[`✗ ${e.message}`,...l.slice(0,49)]) }
  }

  function setOv(node_id, k, v) { setOverrides(p=>({...p,[node_id]:{...(p[node_id]||{}),[k]:v}})) }

  async function updateRole(userId, newRole) {
    try {
      await api.updateUserRole(userId, newRole)
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u))
    } catch(e) { alert(e.message) }
  }

  const chartData = [...nodes].sort((a,b)=>(b.aqi||0)-(a.aqi||0)).map(n=>({
    name: n.location?.split(' ')[0], AQI: n.aqi||0, fill: aqiMeta(n.aqi||0).color
  }))

  const filteredUsers = users.filter(u => !search || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase()))

  const renderContent = () => {
    if (tab === 'overview') return (
      <div className="p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-orange-400 uppercase tracking-widest font-semibold">Administration</p>
            <h1 className="text-2xl font-black text-white mt-1 flex items-center gap-3">System Overview
              <span className="flex items-center gap-1.5 text-xs font-normal">
                <span className={`w-2 h-2 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}/>
                <span className={live ? 'text-green-400' : 'text-white/30'}>{live ? 'Live' : 'Polling'}</span>
              </span>
            </h1>
          </div>
          <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
            <RefreshCw size={14}/> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label:'Active Nodes',    value:nodes.length, color:'#00a2ff' },
            { label:'Registered Users',value:userCount,    color:'#10d343' },
            { label:'Anomalies',       value:anomalies.length, color:anomalies.length>0?'#FF7E00':'#00E400' },
            { label:'Data Control Center', value:simStatus?.running?'Running':'Stopped', color:simStatus?.running?'#00E400':'#FF7E00', text:true },
          ].map(({label,value,color,text})=>(
            <div key={label} className="glass-card p-5 text-center">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-2">{label}</p>
              <p className={`font-black mb-1 ${text?'text-xl':'text-4xl'}`} style={{color}}>{value}</p>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="glass-card p-6">
          <p className="text-xs text-white/40 uppercase tracking-wide mb-4">AQI by Node</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{top:0,right:0,bottom:0,left:-20}}>
              <XAxis dataKey="name" tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'var(--text-muted)',fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:'var(--card-bg)',border:'1px solid var(--card-border)',borderRadius:8,color:'var(--text-main)'}}/>
              <Bar dataKey="AQI" radius={[6,6,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Node cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {nodes.map(n=>{
            const m=aqiMeta(n.aqi||0)
            return (
              <div key={n.node_id} className="glass-card p-4" style={{borderColor:m.color+'20'}}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2"><MapPin size={13} className="text-white/40"/><span className="text-sm font-bold text-white">{n.location}</span></div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{color:m.color,background:m.color+'15'}}>{m.label}</span>
                </div>
                <div className="text-3xl font-black mb-2" style={{color:m.color}}>{n.aqi||0}</div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{width:`${Math.min((n.aqi||0)/500*100,100)}%`,background:m.color}}/>
                </div>
                <p className="text-xs text-white/30 mt-2">{n.district}</p>
              </div>
            )
          })}
        </div>
      </div>
    )

    if (tab === 'nodes') {
      if (selectedNode) {
        const meta = aqiMeta(selectedNode.aqi || 0)
        const trendData = nodeReadings.map(r => ({
          time: formatTime(r.recorded_at),
          aqi: r.aqi || 0
        }))

        return (
          <div className="p-8 max-w-4xl mx-auto space-y-6">
            {/* Header / Back */}
            <div className="flex items-center justify-between">
              <button onClick={() => { setSelectedNode(null); setNodeReadings([]) }}
                className="text-xs text-brandCyan hover:text-white flex items-center gap-1 bg-white/5 border border-white/10 px-3 py-1.5 rounded-btn transition-all">
                ← Back to Nodes List
              </button>
              <h2 className="text-sm font-bold text-white/55">{selectedNode.node_id} Details</h2>
            </div>

            {/* Title / Summary */}
            <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-6"
              style={{ background: `radial-gradient(circle at center, ${meta.color}08 0%, rgba(255,255,255,0.03) 100%)` }}>
              <div className="flex-1">
                <h1 className="text-2xl font-black text-white">{selectedNode.location}</h1>
                <p className="text-xs text-white/40 mt-1">{selectedNode.district}, {selectedNode.state}</p>
                <div className="mt-4 p-3 bg-white/5 border border-white/5 rounded-btn inline-block">
                  <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider block">Cause of Pollution</span>
                  <span className="text-xs text-white/80 font-medium">
                    {nodeReadings[nodeReadings.length - 1]?.cause || selectedNode.cause || 'Automobile emissions & industrial output'}
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
                            <linearGradient id="node-aqi-grad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={meta.color} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={meta.color} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="time" tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false} interval={4}/>
                          <YAxis tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false}/>
                          <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8, color:'var(--text-main)' }}/>
                          <Area type="monotone" dataKey="aqi" stroke={meta.color} strokeWidth={2} fill="url(#node-aqi-grad)" dot={false}/>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
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

                {/* AQI Predictions (ML Forecast) */}
                <div className="glass-card p-6 mt-6">
                  <p className="text-xs text-white/40 uppercase tracking-wide mb-4">AQI Predictions (ML Forecast)</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {['6h', '24h', '48h'].map(horizon => {
                      const pred = nodePredictions.find(p => p.horizon === horizon)
                      const aqiVal = pred ? pred.predicted_aqi : null
                      const meta = aqiVal !== null ? aqiMeta(aqiVal) : { label: 'N/A', color: '#94a3b8' }
                      return (
                        <div key={horizon} className="bg-white/5 border border-white/5 p-4 rounded-btn text-center">
                          <div className="text-xs text-white/40 mb-1">{horizon} Outlook</div>
                          <div className="text-2xl font-black" style={{ color: meta.color }}>
                            {aqiVal !== null ? aqiVal : '—'}
                          </div>
                          <div className="text-[9px] font-bold mt-1 uppercase" style={{ color: meta.color }}>
                            {meta.label}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )
      }

      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Globe size={22} className="text-brandCyan"/> Monitoring Nodes</h1>
            <button onClick={() => setShowAddNode(true)}
              className="flex items-center gap-2 px-4 py-2 bg-brandCyan/20 text-brandCyan hover:bg-brandCyan/30 border border-brandCyan/30 text-sm font-semibold rounded-btn transition-all">
              + Add Node
            </button>
          </div>
          <div className="space-y-4">
            {nodes.map(n=>{
              const m=aqiMeta(n.aqi||0)
              return (
                <div key={n.node_id} onClick={() => selectNodeDetail(n)}
                  className="glass-card p-5 cursor-pointer hover:border-brandCyan/40 active:scale-[0.99] transition-all duration-300">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-bold text-white">{n.location}</p>
                      <p className="text-xs text-white/40">{n.node_id} · {n.district}, {n.state}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-black" style={{color:m.color}}>{n.aqi||0}</div>
                      <div className="text-xs font-semibold" style={{color:m.color}}>{m.label}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {POLLUTANTS.map(({key,label,unit})=>(
                      <div key={key} className="text-xs">
                        <span className="text-white/40">{label}: </span>
                        <span className="text-white font-semibold">{(n[key]||0).toFixed(1)} <span className="text-[10px] text-white/30">{unit}</span></span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-brandCyan/50 mt-3 font-semibold text-right">💡 Click to view detailed analysis →</p>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    if (tab === 'users') {
      const normalUsers = filteredUsers.filter(u => u.role === 'user')
      const authorityUsers = filteredUsers.filter(u => u.role === 'authority')
      
      const states = [...new Set(nodes.map(n => n.state).filter(Boolean))]
      const districts = authForm.state 
        ? [...new Set(nodes.filter(n => n.state === authForm.state).map(n => n.district).filter(Boolean))] 
        : []

      return (
        <div className="p-8 max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-black text-white flex items-center gap-2"><Users size={22} className="text-brandCyan"/> Users & Authorities</h1>
            <div className="flex items-center gap-3">
              {userSubTab === 'authority' && (
                <button onClick={() => { setShowAddAuth(true); setError('') }}
                  className="flex items-center gap-1.5 px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 rounded-btn text-xs font-semibold hover:bg-purple-500/30 transition-all">
                  <Plus size={13}/> Add Authority
                </button>
              )}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
                  className="bg-white/5 border border-white/10 rounded-btn pl-8 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-brandCyan/40 w-56"/>
              </div>
            </div>
          </div>

          {/* Sub-tab navigation */}
          <div className="flex border-b border-white/[0.06] mb-6">
            <button onClick={() => setUserSubTab('users')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all
                ${userSubTab === 'users' ? 'border-brandCyan text-brandCyan' : 'border-transparent text-white/40 hover:text-white/70'}`}>
              Users ({normalUsers.length})
            </button>
            <button onClick={() => setUserSubTab('authority')}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all
                ${userSubTab === 'authority' ? 'border-brandCyan text-brandCyan' : 'border-transparent text-white/40 hover:text-white/70'}`}>
              Authorities ({authorityUsers.length})
            </button>
          </div>

          <p className="text-xs text-white/30 mb-4">
            {userSubTab === 'users' 
              ? 'View all registered residents and grant them authority dashboard access.'
              : 'Manage city authority profiles, assign state/district jurisdictions, and monitor setup status.'}
          </p>

          {userSubTab === 'users' ? (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Name','Email','Node','Phone','Health Condition','Action'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {normalUsers.map(u=>(
                    <tr key={u.user_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{u.full_name}</td>
                      <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{u.location || '—'}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{u.phone_number || '—'}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">
                        {u.condition_name ? `${u.condition_name} (Lvl ${u.severity_level})` : 'None'}
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button onClick={() => handleEditClick(u)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all"
                          title="Edit Profile">
                          <Pencil size={12}/>
                        </button>
                        <button onClick={()=>updateRole(u.user_id,'authority')}
                          className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full border border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-all">
                          <Shield size={10}/> Make Authority
                        </button>
                      </td>
                    </tr>
                  ))}
                  {normalUsers.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-white/20 text-xs">No users found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="glass-card overflow-x-auto">
              <table className="w-full text-sm min-w-[750px]">
                <thead>
                  <tr className="border-b border-white/[0.06]">
                    {['Name','Email','Phone','State','District','Password','Action'].map(h=>(
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {authorityUsers.map(u=>(
                    <tr key={u.user_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{u.full_name}</td>
                      <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{u.phone_number || '—'}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{u.state || '—'}</td>
                      <td className="px-4 py-3 text-white/40 text-xs">{u.district || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                          ${u.must_change_password
                            ?'text-orange-400 border-orange-400/30 bg-orange-400/10'
                            :'text-green-400 border-green-400/30 bg-green-400/10'}`}>
                          {u.must_change_password ? 'Default' : 'Changed'}
                        </span>
                      </td>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <button onClick={() => handleEditClick(u)}
                          className="p-1.5 rounded-full hover:bg-white/10 text-white/50 hover:text-white transition-all"
                          title="Edit Jurisdiction / Profile">
                          <Pencil size={12}/>
                        </button>
                        <button onClick={()=>updateRole(u.user_id,'user')}
                          className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all">
                          Revoke
                        </button>
                      </td>
                    </tr>
                  ))}
                  {authorityUsers.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-white/20 text-xs">No authorities found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Add Authority Modal Overlay */}
          {showAddAuth && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-card max-w-md w-full p-6 space-y-4 animate-fadeIn">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Shield size={18} className="text-purple-400"/> Add New Authority
                </h2>
                <p className="text-xs text-white/40">
                  Create an authority profile. The default login password will be <code className="text-purple-400 font-mono">authority@123</code>.
                </p>
                
                <form onSubmit={handleAddAuthority} className="space-y-3.5">
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Full Name</label>
                    <input type="text" placeholder="e.g. Inspector Rajan" required
                      value={authForm.fullName} onChange={e => setAuthForm(p=>({...p, fullName: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Email Address</label>
                    <input type="email" placeholder="e.g. rajan@authority.gov" required
                      value={authForm.email} onChange={e => setAuthForm(p=>({...p, email: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Phone Number</label>
                    <input type="tel" placeholder="10-digit mobile number" required
                      value={authForm.phone} onChange={e => setAuthForm(p=>({...p, phone: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* State / District Jurisdiction selection */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">State Jurisdiction</label>
                      {states.length > 0 ? (
                        <select required value={authForm.state}
                          onChange={e => setAuthForm(p=>({...p, state: e.target.value, district: ''}))}
                          className="w-full bg-[#060913] border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40">
                          <option value="">Select State</option>
                          {states.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="State" required
                          value={authForm.state} onChange={e => setAuthForm(p=>({...p, state: e.target.value}))}
                          className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                      )}
                    </div>
                    
                    <div>
                      <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">District Jurisdiction</label>
                      {states.length > 0 ? (
                        <select required value={authForm.district}
                          onChange={e => setAuthForm(p=>({...p, district: e.target.value}))}
                          disabled={!authForm.state}
                          className="w-full bg-[#060913] border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40 disabled:opacity-40">
                          <option value="">Select District</option>
                          {districts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : (
                        <input type="text" placeholder="District" required
                          value={authForm.district} onChange={e => setAuthForm(p=>({...p, district: e.target.value}))}
                          className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                      )}
                    </div>
                  </div>

                  {/* Modal Buttons */}
                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => { setShowAddAuth(false); setError('') }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-btn text-xs font-semibold transition-all">
                      Cancel
                    </button>
                    <button type="submit" disabled={loading}
                      className="px-4 py-2 bg-purple-500/20 border border-purple-500/30 text-purple-400 hover:bg-purple-500/30 rounded-btn text-xs font-semibold transition-all disabled:opacity-50">
                      {loading ? 'Adding...' : 'Create Account'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Edit Profile Modal Overlay */}
          {showEditModal && editingUser && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="glass-card max-w-md w-full p-6 space-y-4 animate-fadeIn">
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Pencil size={18} className="text-brandCyan"/> Edit {editingUser.role === 'authority' ? 'Authority' : 'User'} Profile
                </h2>
                <p className="text-xs text-white/40">
                  Update details for {editingUser.full_name}.
                </p>
                
                <form onSubmit={handleEditSubmit} className="space-y-3.5">
                  {/* Name */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Full Name</label>
                    <input type="text" required
                      value={editForm.fullName} onChange={e => setEditForm(p=>({...p, fullName: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Email Address</label>
                    <input type="email" required
                      value={editForm.email} onChange={e => setEditForm(p=>({...p, email: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Phone Number</label>
                    <input type="tel" required
                      value={editForm.phone} onChange={e => setEditForm(p=>({...p, phone: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                  </div>

                  {/* Jurisdiction state/district (For Authority) */}
                  {editingUser.role === 'authority' && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">State Jurisdiction</label>
                        {states.length > 0 ? (
                          <select required value={editForm.state}
                            onChange={e => setEditForm(p=>({...p, state: e.target.value, district: ''}))}
                            className="w-full bg-[#060913] border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40">
                            <option value="">Select State</option>
                            {states.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        ) : (
                          <input type="text" placeholder="State" required
                            value={editForm.state} onChange={e => setEditForm(p=>({...p, state: e.target.value}))}
                            className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                        )}
                      </div>
                      
                      <div>
                        <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">District Jurisdiction</label>
                        {states.length > 0 ? (
                          <select required value={editForm.district}
                            onChange={e => setEditForm(p=>({...p, district: e.target.value}))}
                            disabled={!editForm.state}
                            className="w-full bg-[#060913] border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40 disabled:opacity-40">
                            <option value="">Select District</option>
                            {editForm.state ? [...new Set(nodes.filter(n => n.state === editForm.state).map(n => n.district).filter(Boolean))].map(d => <option key={d} value={d}>{d}</option>) : null}
                          </select>
                        ) : (
                          <input type="text" placeholder="District" required
                            value={editForm.district} onChange={e => setEditForm(p=>({...p, district: e.target.value}))}
                            className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Location Node selection (For Citizen) */}
                  {editingUser.role === 'user' && (
                    <div>
                      <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Monitoring Node Location</label>
                      <select required value={editForm.nodeId}
                        onChange={e => setEditForm(p=>({...p, nodeId: e.target.value}))}
                        className="w-full bg-[#060913] border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40">
                        <option value="">Select Node Location</option>
                        {nodes.map(n => <option key={n.node_id} value={n.node_id}>{n.location} ({n.district})</option>)}
                      </select>
                    </div>
                  )}

                  {/* Modal Buttons */}
                  <div className="flex justify-end gap-2 pt-3">
                    <button type="button" onClick={() => { setShowEditModal(false); setEditingUser(null) }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-btn text-xs font-semibold transition-all">
                      Cancel
                    </button>
                    <button type="submit" disabled={loading}
                      className="px-4 py-2 bg-brandCyan/20 border border-brandCyan/30 text-brandCyan hover:bg-brandCyan/30 rounded-btn text-xs font-semibold transition-all disabled:opacity-50">
                      {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )
    }

    if (tab === 'simulation') return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Activity size={22} className="text-brandCyan"/> Data Control Center</h1>

        {/* Controls */}
        <div className="glass-card p-6 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border
              ${simStatus?.running?'text-brandGreen border-brandGreen/30 bg-brandGreen/10':'text-white/40 border-white/10'}`}>
              <span className={`w-2 h-2 rounded-full ${simStatus?.running?'bg-brandGreen animate-pulse':'bg-white/20'}`}/>
              {simStatus?.running?'Running':'Stopped'}
            </div>
            <button onClick={startSim} disabled={simStatus?.running}
              className="flex items-center gap-2 px-4 py-2 bg-brandGreen/20 border border-brandGreen/30 text-brandGreen rounded-btn text-sm font-semibold hover:bg-brandGreen/30 transition-all disabled:opacity-40">
              <Play size={14}/> Start
            </button>
            <button onClick={stopSim} disabled={!simStatus?.running}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 border border-red-500/30 text-red-400 rounded-btn text-sm font-semibold hover:bg-red-500/30 transition-all disabled:opacity-40">
              <Pause size={14}/> Stop
            </button>
          </div>

          <div className="flex items-center gap-4 border-l border-white/10 pl-6">
            <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Source Mode:</span>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
              <input type="radio" name="simMode" value="now" checked={simMode === 'now'} onChange={() => setSimMode('now')} disabled={simStatus?.running} className="accent-brandCyan cursor-pointer" />
              Now (Random Data)
            </label>
            <label className="flex items-center gap-2 text-sm text-white/80 cursor-pointer select-none">
              <input type="radio" name="simMode" value="dataset" checked={simMode === 'dataset'} onChange={() => setSimMode('dataset')} disabled={simStatus?.running} className="accent-brandCyan cursor-pointer" />
              From Dataset
            </label>
          </div>
        </div>


        {/* Manual Reading Insert */}
        <div className="space-y-3">
          <p className="text-xs text-white/40 uppercase tracking-wide font-semibold">Manual Reading Insert</p>
          <p className="text-xs text-white/25">Inserts a reading directly into the database and triggers push notifications — no simulation required.</p>
          {nodes.map(n=>{
            const ov=overrides[n.node_id]||{}
            const m=aqiMeta(n.aqi||0)
            const fields = [
              { k:'aqi',   label:'AQI',   required:true },
              { k:'pm25',  label:'PM2.5' },
              { k:'pm10',  label:'PM10'  },
              { k:'co',    label:'CO'    },
              { k:'nh3',   label:'NH3'   },
              { k:'no2',   label:'NO2'   },
              { k:'ozone', label:'Ozone' },
            ]
            return (
              <div key={n.node_id} className="glass-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-bold text-white">{n.location}</p>
                    <p className="text-xs font-bold mt-0.5" style={{color:m.color}}>Current AQI: {n.aqi||0}</p>
                  </div>
                  <button onClick={()=>insertReading(n.node_id, n.location)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-brandBlue/20 border border-brandBlue/30 text-brandCyan rounded-btn text-xs font-semibold hover:bg-brandBlue/30 transition-all">
                    <Plus size={12}/> Insert Reading
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {fields.map(({k, label, required})=>(
                    <div key={k}>
                      <p className="text-[10px] text-white/35 mb-1">{label}{required?' *':''}</p>
                      <input type="number" placeholder="—" value={ov[k]||''} onChange={e=>setOv(n.node_id,k,e.target.value)}
                        className={`w-full bg-white/5 border rounded-btn px-2 py-1.5 text-xs text-white outline-none placeholder-white/20
                          ${required?'border-brandCyan/30 focus:border-brandCyan/60':'border-white/10 focus:border-brandCyan/40'}`}/>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Log */}
        {simLog.length>0 && (
          <div className="glass-card p-4">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-3">Activity Log</p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {simLog.map((l,i)=>(
                <p key={i} className={`text-xs font-mono ${l.startsWith('✗')?'text-red-400':l.startsWith('✓')?'text-brandGreen':'text-white/50'}`}>{l}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    )

    if (tab === 'anomalies') return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-white flex items-center gap-2 mb-6"><Zap size={22} className="text-brandCyan"/> AI Anomaly Detection</h1>
        {loading ? <div className="text-white/30 text-center py-10">Loading…</div> :
          anomalies.length===0 ? (
            <div className="glass-card p-10 text-center">
              <Check size={40} className="text-brandGreen mx-auto mb-3"/>
              <p className="text-white font-semibold">No anomalies detected</p>
              <p className="text-white/40 text-sm mt-1">Isolation Forest model has not flagged any unusual readings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {anomalies.map((a,i)=>(
                <div key={i} className="glass-card p-5 flex items-start gap-4 border-l-4 border-orange-500/50">
                  <Zap size={18} className="text-orange-400 mt-0.5"/>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-white">{a.location}</p>
                      <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">Anomaly</span>
                    </div>
                    <p className="text-sm text-white/50">AQI <span className="text-orange-400 font-bold">{a.aqi}</span> — flagged as statistically unusual by Isolation Forest</p>
                    <p className="text-xs text-white/25 mt-1">{a.recorded_at?new Date(a.recorded_at).toLocaleString():''}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    )
  }

  return (
    <AppShell role="admin" onSignOut={onSignOut} activeTab={tab} onTabChange={setTab} theme={theme} toggleTheme={toggleTheme}>
      {renderContent()}

      {/* Add Node Modal Overlay */}
      {showAddNode && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-lg w-full p-6 space-y-4 animate-fadeIn overflow-y-auto max-h-[90vh]">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <Globe size={18} className="text-brandCyan"/> Register New Monitoring Node
            </h2>
            <p className="text-xs text-white/40">
              Register a new hardware sensing node in the network and initialize its database telemetry profile.
            </p>
            
            <form onSubmit={handleAddNode} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Node ID</label>
                  <input type="text" placeholder="e.g. NODE006" required
                    value={nodeForm.node_id} onChange={e=>setNodeForm(p=>({...p, node_id: e.target.value.toUpperCase()}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Location Name</label>
                  <input type="text" placeholder="e.g. Adyar Park" required
                    value={nodeForm.location} onChange={e=>setNodeForm(p=>({...p, location: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">District</label>
                  <input type="text" placeholder="e.g. Chennai" required
                    value={nodeForm.district} onChange={e=>setNodeForm(p=>({...p, district: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">State</label>
                  <input type="text" placeholder="e.g. Tamil Nadu" required
                    value={nodeForm.state} onChange={e=>setNodeForm(p=>({...p, state: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Pincode</label>
                  <input type="text" placeholder="e.g. 600020" required
                    value={nodeForm.pincode} onChange={e=>setNodeForm(p=>({...p, pincode: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Latitude</label>
                  <input type="number" step="any" placeholder="e.g. 13.0012" required
                    value={nodeForm.latitude} onChange={e=>setNodeForm(p=>({...p, latitude: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Longitude</label>
                  <input type="number" step="any" placeholder="e.g. 80.2565" required
                    value={nodeForm.longitude} onChange={e=>setNodeForm(p=>({...p, longitude: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Zone Type</label>
                  <select value={nodeForm.zone_type} onChange={e=>setNodeForm(p=>({...p, zone_type: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40">
                    <option value="Residential" className="bg-[#0c0d12]">Residential</option>
                    <option value="Commercial" className="bg-[#0c0d12]">Commercial</option>
                    <option value="Industrial" className="bg-[#0c0d12]">Industrial</option>
                    <option value="Sensitive" className="bg-[#0c0d12]">Sensitive</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Pop. Density</label>
                  <input type="number" required
                    value={nodeForm.population_density} onChange={e=>setNodeForm(p=>({...p, population_density: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Green Cover %</label>
                  <input type="number" step="any" required
                    value={nodeForm.green_cover_percentage} onChange={e=>setNodeForm(p=>({...p, green_cover_percentage: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-btn px-3 py-2 text-sm text-white outline-none focus:border-brandCyan/40"/>
                </div>
              </div>

              <div className="space-y-1 py-1.5">
                <span className="text-[10px] font-semibold text-white/50 uppercase block mb-1">Environmental Proximity Factors</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={nodeForm.near_highway} onChange={e=>setNodeForm(p=>({...p, near_highway: e.target.checked}))}
                      className="rounded bg-white/5 border-white/10 text-brandCyan focus:ring-0 focus:ring-offset-0"/>
                    Near Highway
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={nodeForm.near_factory} onChange={e=>setNodeForm(p=>({...p, near_factory: e.target.checked}))}
                      className="rounded bg-white/5 border-white/10 text-brandCyan focus:ring-0 focus:ring-offset-0"/>
                    Near Factory
                  </label>
                  <label className="flex items-center gap-2 text-xs text-white/70 cursor-pointer">
                    <input type="checkbox" checked={nodeForm.near_construction} onChange={e=>setNodeForm(p=>({...p, near_construction: e.target.checked}))}
                      className="rounded bg-white/5 border-white/10 text-brandCyan focus:ring-0 focus:ring-offset-0"/>
                    Near Construction
                  </label>
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button type="button" onClick={() => setShowAddNode(false)}
                  className="flex-1 px-4 py-2 border border-white/10 hover:bg-white/5 text-sm font-semibold rounded-btn transition-all text-white/70">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 px-4 py-2 bg-brandCyan text-black hover:bg-brandCyan/80 disabled:opacity-40 text-sm font-bold rounded-btn transition-all">
                  {loading ? 'Registering...' : 'Register Node'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  )
}
