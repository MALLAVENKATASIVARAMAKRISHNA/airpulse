import { useCallback, useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, MapPin } from 'lucide-react'
import AppShell from '../components/AppShell'
import ForecastPage from './ForecastPage'
import HotspotPage from './HotspotPage'
import HealthAssessmentPage from './HealthAssessmentPage'
import RecommendationsPage from './RecommendationsPage'
import SourceAnalysisPage from './SourceAnalysisPage'
import AlertCenterPage from './AlertCenterPage'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400', bg: 'rgba(0,228,0,0.1)' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442', bg: 'rgba(118,196,66,0.1)' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00', bg: 'rgba(255,255,0,0.1)' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00', bg: 'rgba(255,126,0,0.1)' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000', bg: 'rgba(255,0,0,0.1)' }
  return               { label: 'Severe',         color: '#8F3F97', bg: 'rgba(143,63,151,0.1)' }
}

function getWarnThreshold(cond, sev, age) {
  const c = (cond || '').toLowerCase(), yr = parseInt(age) || 30
  const infant = yr<=2, child=yr>=3&&yr<=12, elderly=yr>=60
  let warn = 201
  if (c.includes('asthma'))        warn = (infant||child) ? 100 : elderly ? 101 : 151
  else if (c.includes('copd'))     warn = elderly ? 101 : 151
  else if (c.includes('heart'))    warn = elderly ? 101 : 151
  else if (c.includes('diabetes')) warn = elderly ? 101 : 151
  else if (c.includes('children')) warn = 100
  else if (c.includes('elderly'))  warn = 101
  else {
    if (infant||child) warn=100
    else if (elderly)  warn=101
  }
  const mod = sev==='High'?-25:sev==='Low'?25:0
  return Math.max(50, warn+mod)
}

const POLLUTANTS = [
  { key:'pm25',  label:'PM2.5', unit:'µg/m³', limit:60,  color:'#EF5350' },
  { key:'pm10',  label:'PM10',  unit:'µg/m³', limit:100, color:'#FF7043' },
  { key:'no2',   label:'NO2',   unit:'µg/m³', limit:80,  color:'#AB47BC' },
  { key:'co',    label:'CO',    unit:'mg/m³',  limit:10,  color:'#FFA726' },
  { key:'ozone', label:'Ozone', unit:'µg/m³', limit:100, color:'#42A5F5' },
  { key:'nh3',   label:'NH3',   unit:'µg/m³', limit:400, color:'#FFCA28' },
]

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}

export default function UserDashboard({ profile, health, onSignOut }) {
  const [tab,      setTab]      = useState('overview')
  const [reading,  setReading]  = useState(null)
  const [readings, setReadings] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [live,     setLive]     = useState(false)
  const clientRef = useRef(null)
  const locationRef = useRef({})

  const loadHistory = useCallback(async () => {
    try {
      const [nodes, hist] = await Promise.all([api.latestAll(), api.nodeReadings(profile.node_id)])
      const mine = (nodes||[]).find(n => n.node_id === profile.node_id)
      if (mine) {
        locationRef.current = { location: mine.location, district: mine.district }
        setReading(prev => prev ? { ...prev, ...locationRef.current } : mine)
      }
      setReadings((hist||[]).slice(0,24).reverse())
    } catch {}
    setLoading(false)
  }, [profile.node_id])

  // Initial load + history refresh every 5 minutes
  useEffect(() => {
    loadHistory()
    const id = setInterval(loadHistory, 300000)
    return () => clearInterval(id)
  }, [loadHistory])

  const [mlData, setMlData] = useState(null)

  // MQTT WebSocket — real-time readings + ML results from IoT Core
  useEffect(() => {
    let client
    api.getIotUrl().then(({ url }) => {
      client = mqtt.connect(url, { clientId: `web-${profile.user_id}-${Date.now()}` })
      clientRef.current = client

      client.on('connect', () => {
        client.subscribe(`airpulse/readings/${profile.node_id}`)
        client.subscribe(`airpulse/ml/${profile.node_id}`)
        setLive(true)
      })

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString())
          if (topic.startsWith('airpulse/ml/')) {
            setMlData(data)
          } else {
            setReading(prev => ({ ...locationRef.current, ...prev, ...data }))
            setLoading(false)
          }
        } catch {}
      })

      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})

    return () => { client?.end(true); setLive(false) }
  }, [profile.node_id, profile.user_id])


  const aqi      = reading?.aqi || 0
  const meta     = aqiMeta(aqi)
  const warnAt   = health ? getWarnThreshold(health.condition_name, health.severity_level, health.age) : 201
  const isDanger = aqi >= warnAt
  const chartData = readings.map(r => ({ time: formatTime(r.recorded_at), aqi: r.aqi||0 }))

  const renderContent = () => {
    if (tab === 'forecast')        return <ForecastPage profile={profile} currentAqi={aqi} mlData={mlData} />
    if (tab === 'hotspot')         return <HotspotPage profile={profile} />
    if (tab === 'health')          return <HealthAssessmentPage profile={profile} health={health} />
    if (tab === 'recommendations') return <RecommendationsPage profile={profile} health={health} />
    if (tab === 'sources')         return <SourceAnalysisPage profile={profile} />
    if (tab === 'alerts')          return <AlertCenterPage profile={profile} />
    if (tab === 'air')             return <PollutantsView reading={reading} loading={loading} onRefresh={load} />

    // Overview
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest">Live Air Intelligence</p>
            <h1 className="text-2xl font-black text-white mt-1">
              {profile.full_name?.split(' ')[0]}'s Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className={`w-2 h-2 rounded-full ${live ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`}/>
              <span className={live ? 'text-green-400' : 'text-white/30'}>{live ? 'Live' : 'Offline'}</span>
            </div>
            <button onClick={loadHistory} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
              <RefreshCw size={14}/> Refresh
            </button>
          </div>
        </div>

        {/* Location bar */}
        <div className="flex items-center gap-2 text-sm text-white/40">
          <MapPin size={14} className="text-brandCyan"/>
          <span>{reading?.location || '—'}, {reading?.district || 'Chennai'}</span>
          <span className="ml-auto text-xs">Updated {formatTime(reading?.recorded_at)}</span>
        </div>

        {/* Danger banner */}
        {isDanger && (
          <div className="glass-card p-4 border-l-4 border-red-500 flex items-center gap-4" style={{ borderLeftColor: meta.color }}>
            <span className="text-2xl">⚠️</span>
            <div>
              <p className="text-sm font-bold text-white">Poor Air Quality Alert</p>
              <p className="text-sm text-white/60">AQI {aqi} exceeds your safe limit of {warnAt}. Limit outdoor activity.</p>
            </div>
          </div>
        )}

        {/* AQI Hero */}
        <div className="glass-card p-8 flex flex-col items-center text-center" style={{ borderColor: meta.color + '30' }}>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-4">Air Quality Index</p>
          <div className="relative mb-4">
            <div className="text-8xl font-black" style={{ color: meta.color }}>{aqi}</div>
            <div className="absolute -right-6 top-1 text-xs font-bold px-2 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>{meta.label}</div>
          </div>
          <div className="w-full h-3 rounded-full bg-gradient-to-r from-[#00E400] via-[#FFFF00] via-[#FF7E00] to-[#8F3F97] relative mb-2">
            <div className="absolute -top-1 w-5 h-5 rounded-full bg-white border-2 border-darkBg shadow-lg transition-all"
              style={{ left: `${Math.min(aqi/500*100,98)}%`, transform:'translateX(-50%)' }} />
          </div>
          <div className="flex justify-between w-full text-[10px] text-white/30 mt-1">
            <span>0</span><span>100</span><span>200</span><span>300</span><span>400</span><span>500</span>
          </div>
          {reading?.dominant_pollutant && (
            <p className="mt-4 text-sm text-white/50">Dominant: <span className="font-bold" style={{ color: meta.color }}>{reading.dominant_pollutant}</span></p>
          )}
        </div>

        {/* Pollutant quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {POLLUTANTS.map(({ key, label, unit, limit, color }) => {
            const val = reading?.[key] || 0
            const pct = Math.min((val/limit)*100, 100)
            return (
              <div key={key} className="glass-card p-4 text-center">
                <div className="text-xs text-white/40 mb-1">{label}</div>
                <div className="text-xl font-black mb-1" style={{ color }}>{val.toFixed(1)}</div>
                <div className="text-[10px] text-white/30 mb-2">{unit}</div>
                <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width:`${pct}%`, background:color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Trend chart */}
        {chartData.length > 0 && (
          <div className="glass-card p-6">
            <p className="text-xs text-white/40 uppercase tracking-wide mb-4">AQI Trend · Last {chartData.length} readings</p>
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData} margin={{ top:0, right:0, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="aqi-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={meta.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={meta.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" tick={{ fill:'rgba(255,255,255,0.3)', fontSize:10 }} axisLine={false} tickLine={false} interval={4}/>
                <YAxis tick={{ fill:'rgba(255,255,255,0.3)', fontSize:10 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'#060913', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'white' }}/>
                <Area type="monotone" dataKey="aqi" stroke={meta.color} strokeWidth={2} fill="url(#aqi-grad)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Health tip */}
        <div className="glass-card p-5" style={{ borderColor: meta.color + '25' }}>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Health Guidance</p>
          <p className="text-sm text-white/80 leading-relaxed">{getHealthTip(aqi, health?.condition_name)}</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell role="user" onSignOut={onSignOut} activeTab={tab} onTabChange={setTab}>
      {renderContent()}
    </AppShell>
  )
}

function PollutantsView({ reading, loading, onRefresh }) {
  if (loading) return <div className="p-8 flex items-center justify-center h-40 text-white/30">Loading…</div>
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Wind size={22} className="text-brandCyan"/> Air Quality Detail
        </h1>
        <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {POLLUTANTS.map(({ key, label, unit, limit, color }) => {
          const val = reading?.[key] || 0
          const pct = Math.min((val/limit)*100, 100)
          const status = pct>=100?'Exceeds Limit':pct>=80?'High':pct>=50?'Moderate':'Safe'
          const statusColor = pct>=100?'#FF0000':pct>=80?'#FF7E00':pct>=50?'#FFFF00':'#00E400'
          return (
            <div key={key} className="glass-card p-5" style={{ borderColor: color+'20' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">{label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color:statusColor, background:statusColor+'15' }}>{status}</span>
              </div>
              <div className="text-3xl font-black mb-1" style={{ color }}>{val.toFixed(1)}</div>
              <div className="text-xs text-white/40 mb-3">{unit} <span className="text-white/20">/ limit {limit}</span></div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width:`${pct}%`, background:color }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function getHealthTip(aqi, condition) {
  const c = (condition||'').toLowerCase()
  if (aqi <= 50)  return 'Air quality is good. Safe for all activities outdoors.'
  if (aqi <= 100) return 'Air quality is satisfactory. Sensitive individuals should reduce prolonged outdoor exertion.'
  if (aqi <= 200) {
    if (c.includes('asthma')||c.includes('copd')) return 'Moderate air quality. Keep your inhaler handy and avoid prolonged outdoor activity.'
    return 'Moderate air quality. Sensitive groups may experience minor irritation.'
  }
  if (aqi <= 300) return 'Poor air quality. Everyone should reduce outdoor activity. Wear an N95 mask if going outside.'
  return 'Very poor to severe air quality. Stay indoors, keep windows closed. Seek medical help if you feel unwell.'
}
