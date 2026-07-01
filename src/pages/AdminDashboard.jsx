import { useCallback, useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { Activity, Check, MapPin, Pause, Play, Plus, RefreshCw, Search, Shield, Users, Zap, Globe } from 'lucide-react'
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
  { key:'pm25', label:'PM2.5', max:200 }, { key:'pm10', label:'PM10', max:300 },
  { key:'co',   label:'CO',    max:30  }, { key:'no2',  label:'NO2',  max:200 },
  { key:'ozone',label:'Ozone', max:200 }, { key:'nh3',  label:'NH3',  max:400 },
]

export default function AdminDashboard({ profile, onSignOut }) {
  const [tab,       setTab]       = useState('overview')
  const [nodes,     setNodes]     = useState([])
  const [users,     setUsers]     = useState([])
  const [userCount, setUserCount] = useState(0)
  const [anomalies, setAnomalies] = useState([])
  const [simStatus, setSimStatus] = useState(null)
  const [simInterval, setSimInterval] = useState(30)
  const [simLog,    setSimLog]    = useState([])
  const [overrides, setOverrides] = useState({})
  const [loading,   setLoading]   = useState(true)
  const [search,    setSearch]    = useState('')
  const [live,      setLive]      = useState(false)

  const load = useCallback(async () => {
    try {
      const [n, uc, s, a] = await Promise.all([api.latestAll(), api.userCount(), api.simStatus(), api.anomalies()])
      setNodes(n||[])
      setUserCount(uc?.count||0)
      setSimStatus(s)
      setAnomalies(a||[])
    } catch {}
    setLoading(false)
  }, [])

  const loadUsers = useCallback(async () => {
    try { setUsers(await api.users()||[]) } catch {}
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 15000)
    return () => clearInterval(id)
  }, [load])

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
        } catch {}
      })
      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})
    return () => { client?.end(true); setLive(false) }
  }, [])

  useEffect(() => { if (tab==='users') loadUsers() }, [tab, loadUsers])

  async function startSim()  { try { await api.simStart(simInterval); await load(); setSimLog(l=>[`▶ Simulation started (${simInterval}s interval)`,...l.slice(0,49)]) } catch(e){setSimLog(l=>[`✗ ${e.message}`,...l.slice(0,49)])} }
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
        <div className="grid grid-cols-4 gap-4">
          {[
            { label:'Active Nodes',    value:nodes.length, color:'#00a2ff' },
            { label:'Registered Users',value:userCount,    color:'#10d343' },
            { label:'Anomalies',       value:anomalies.length, color:anomalies.length>0?'#FF7E00':'#00E400' },
            { label:'Simulation',      value:simStatus?.running?'Running':'Stopped', color:simStatus?.running?'#00E400':'#FF7E00', text:true },
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
              <XAxis dataKey="name" tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:'rgba(255,255,255,0.4)',fontSize:11}} axisLine={false} tickLine={false}/>
              <Tooltip contentStyle={{background:'#060913',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,color:'white'}}/>
              <Bar dataKey="AQI" radius={[6,6,0,0]}>{chartData.map((d,i)=><Cell key={i} fill={d.fill}/>)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Node cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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

    if (tab === 'nodes') return (
      <div className="p-8 max-w-4xl mx-auto">
        <h1 className="text-2xl font-black text-white mb-6 flex items-center gap-2"><Globe size={22} className="text-brandCyan"/> Monitoring Nodes</h1>
        <div className="space-y-4">
          {nodes.map(n=>{
            const m=aqiMeta(n.aqi||0)
            return (
              <div key={n.node_id} className="glass-card p-5">
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
                  {POLLUTANTS.slice(0,6).map(({key,label,max})=>(
                    <div key={key} className="text-xs">
                      <span className="text-white/40">{label}: </span>
                      <span className="text-white font-semibold">{(n[key]||0).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )

    if (tab === 'users') return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-black text-white flex items-center gap-2"><Users size={22} className="text-brandCyan"/> Users ({userCount})</h1>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
              className="bg-white/5 border border-white/10 rounded-btn pl-8 pr-4 py-2 text-sm text-white placeholder-white/25 outline-none focus:border-brandCyan/40 w-56"/>
          </div>
        </div>
        <p className="text-xs text-white/30 mb-4">Grant Authority access to let a user view the city-wide Authority Dashboard.</p>
        <div className="glass-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06]">
                {['Name','Email','Node','Role','Action'].map(h=>(
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-white/40 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u=>(
                <tr key={u.user_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 font-medium text-white">{u.full_name}</td>
                  <td className="px-4 py-3 text-white/60 text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-white/40 text-xs">{u.node_id}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border
                      ${u.role==='authority'
                        ?'text-purple-400 border-purple-400/30 bg-purple-400/10'
                        :'text-brandCyan border-brandCyan/30 bg-brandCyan/10'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.role === 'authority' ? (
                      <button onClick={()=>updateRole(u.user_id,'user')}
                        className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full border border-white/10 text-white/40 hover:text-white hover:border-white/30 transition-all">
                        Revoke
                      </button>
                    ) : (
                      <button onClick={()=>updateRole(u.user_id,'authority')}
                        className="flex items-center gap-1 text-[11px] px-3 py-1 rounded-full border border-purple-500/30 text-purple-400 bg-purple-500/10 hover:bg-purple-500/20 transition-all">
                        <Shield size={10}/> Make Authority
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )

    if (tab === 'simulation') return (
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <h1 className="text-2xl font-black text-white flex items-center gap-2"><Activity size={22} className="text-brandCyan"/> Simulation Control</h1>

        {/* Controls */}
        <div className="glass-card p-6 flex items-center gap-4 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border
            ${simStatus?.running?'text-brandGreen border-brandGreen/30 bg-brandGreen/10':'text-white/40 border-white/10'}`}>
            <span className={`w-2 h-2 rounded-full ${simStatus?.running?'bg-brandGreen animate-pulse':'bg-white/20'}`}/>
            {simStatus?.running?'Running':'Stopped'}
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-white/40">Interval (s)</label>
            <input type="number" value={simInterval} onChange={e=>setSimInterval(parseInt(e.target.value)||30)} min={5} max={300}
              className="w-20 bg-white/5 border border-white/10 rounded-btn px-3 py-1.5 text-sm text-white outline-none focus:border-brandCyan/40"/>
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
                <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
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
    <AppShell role="admin" onSignOut={onSignOut} activeTab={tab} onTabChange={setTab}>
      {renderContent()}
    </AppShell>
  )
}
