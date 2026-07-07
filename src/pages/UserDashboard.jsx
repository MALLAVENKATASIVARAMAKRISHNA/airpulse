import { useCallback, useEffect, useRef, useState } from 'react'
import mqtt from 'mqtt'
import { Area, AreaChart, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { RefreshCw, MapPin, Wind } from 'lucide-react'
import AppShell from '../components/AppShell'
import ForecastPage from './ForecastPage'
import HotspotPage from './HotspotPage'
import HealthAssessmentPage from './HealthAssessmentPage'
import RecommendationsPage from './RecommendationsPage'
import SourceAnalysisPage from './SourceAnalysisPage'
import AlertCenterPage from './AlertCenterPage'
import SettingsPage from './SettingsPage'
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
  { key:'pm25',  subAqiKey:'sub_aqi_pm25',  label:'PM2.5', unit:'µg/m³', limit:60,  color:'#EF5350' },
  { key:'pm10',  subAqiKey:'sub_aqi_pm10',  label:'PM10',  unit:'µg/m³', limit:100, color:'#FF7043' },
  { key:'no2',   subAqiKey:'sub_aqi_no2',   label:'NO2',   unit:'µg/m³', limit:80,  color:'#AB47BC' },
  { key:'co',    subAqiKey:'sub_aqi_co',    label:'CO',    unit:'mg/m³',  limit:10,  color:'#FFA726' },
  { key:'ozone', subAqiKey:'sub_aqi_ozone', label:'Ozone', unit:'µg/m³', limit:100, color:'#42A5F5' },
  { key:'nh3',   subAqiKey:'sub_aqi_nh3',   label:'NH3',   unit:'µg/m³', limit:400, color:'#FFCA28' },
]

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })
}

const forecast30Data = [
  { day: 1, actual: 45, predicted: 50 },
  { day: 2, actual: 65, predicted: 72 },
  { day: 3, actual: 60, predicted: 58 },
  { day: 4, actual: 55, predicted: 62 },
  { day: 5, actual: 70, predicted: 68 },
  { day: 6, actual: 68, predicted: 75 },
  { day: 7, actual: 72, predicted: 70 },
  { day: 8, actual: 95, predicted: 88 },
  { day: 9, actual: 60, predicted: 64 },
  { day: 10, actual: 62, predicted: 58 },
  { day: 11, actual: 110, predicted: 102 },
  { day: 12, actual: 105, predicted: 108 },
  { day: 13, actual: 125, predicted: 115 },
  { day: 14, actual: 55, predicted: 60 },
  { day: 15, actual: 48, predicted: 42 },
  { day: 16, actual: 45, predicted: 40 },
  { day: 17, actual: 32, predicted: 35, showLabel: true },
  { day: 18, actual: 58, predicted: 62 },
  { day: 19, actual: 65, predicted: 70 },
  { day: 20, actual: 75, predicted: 72 },
  { day: 21, actual: 80, predicted: 82 },
  { day: 22, actual: 68, predicted: 62 },
  { day: 23, actual: 65, predicted: 60 },
  { day: 24, actual: 58, predicted: 63 },
  { day: 25, actual: 60, predicted: 55 },
  { day: 26, actual: 62, predicted: 58 },
  { day: 27, actual: 60, predicted: 65 }
]

function CustomPredictDot(props) {
  const { cx, cy, payload, color = '#10d343' } = props
  if (payload.showLabel) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={5} fill={color} stroke="#000" strokeWidth={2} />
        <rect x={cx - 50} y={cy - 35} width={100} height={24} rx={4} fill="var(--card-bg)" stroke="var(--card-border)" strokeWidth={1} />
        <text x={cx} y={cy - 20} fill="var(--text-main)" fontSize={10} fontWeight="bold" textAnchor="middle">
          Predicted AQI 35
        </text>
        <line x1={cx} y1={cy - 5} x2={cx} y2={cy - 11} stroke="var(--text-muted)" opacity={0.4} strokeWidth={1} />
      </g>
    )
  }
  return <circle cx={cx} cy={cy} r={3} fill={color} opacity={0.6} />
}

export default function UserDashboard({ profile, health, onSignOut, onReloadUser, theme, toggleTheme }) {
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
    if (tab === 'forecast')        return <ForecastPage profile={profile} currentAqi={aqi} mlData={mlData} health={health} />
    if (tab === 'hotspot')         return <HotspotPage profile={profile} />
    if (tab === 'health')          return <HealthAssessmentPage profile={profile} health={health} />
    if (tab === 'recommendations') return <RecommendationsPage profile={profile} health={health} />
    if (tab === 'sources')         return <SourceAnalysisPage profile={profile} />
    if (tab === 'alerts')          return <AlertCenterPage profile={profile} />
    if (tab === 'settings')        return <SettingsPage profile={profile} health={health} onReloadUser={onReloadUser} />
    if (tab === 'air')             return <PollutantsView reading={reading} loading={loading} onRefresh={loadHistory} />

    // Overview
    return (
      <div className="p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Live Air Intelligence</p>
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
          <span className="ml-auto text-xs text-white/30">Updated {formatTime(reading?.recorded_at)}</span>
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
        <div className="glass-card p-8 flex flex-col items-center text-center hover:shadow-[0_0_30px_rgba(0,106,255,0.08)] transition-all duration-500" style={{ borderColor: meta.color + '25' }}>
          <p className="text-xs text-white/40 uppercase tracking-widest mb-6">Air Quality Index</p>
          
          <div className="relative w-48 h-48 flex items-center justify-center mb-6">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="aqi-hero-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={meta.color} />
                  <stop offset="100%" stopColor={meta.color} stopOpacity={0.4} />
                </linearGradient>
              </defs>
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="rgba(255, 255, 255, 0.04)"
                strokeWidth="8"
              />
              {/* Hardware-friendly ambient glow stroke */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={meta.color}
                strokeWidth="12"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * Math.min(aqi, 500)) / 500}
                strokeLinecap="round"
                opacity="0.16"
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
              {/* Foreground circle with dynamic fill */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="url(#aqi-hero-glow)"
                strokeWidth="8"
                strokeDasharray="251.2"
                strokeDashoffset={251.2 - (251.2 * Math.min(aqi, 500)) / 500}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-6xl font-black tracking-tighter" style={{ color: meta.color }}>
                {aqi}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/30 mt-1">
                AQI Index
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full mt-2" style={{ background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
            </div>
          </div>

          {reading?.dominant_pollutant && (
            <p className="text-sm text-white/50">
              Dominant Pollutant: <span className="font-bold" style={{ color: meta.color }}>{reading.dominant_pollutant}</span>
            </p>
          )}
        </div>

        {/* Pollutant quick stats */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {POLLUTANTS.map(({ key, subAqiKey, label, color }) => {
            const subAqi = reading?.[subAqiKey] || 0
            const pct = Math.min((subAqi / 500) * 100, 100)
            return (
              <div key={key} className="glass-card p-4 text-center group hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
                style={{ background: `radial-gradient(circle at center, ${color}08 0%, rgba(255,255,255,0.03) 100%)` }}>
                <div className="text-xs text-white/40 mb-2 font-semibold group-hover:text-white/60 transition-colors">{label}</div>
                <div className="text-3xl font-black mb-3 transition-transform group-hover:scale-105 duration-300" style={{ color }}>
                  {subAqi}
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background:color }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Superimposed AQI Prediction (30-Day Forecast) composed chart */}
          <div className="glass-card p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wide">AQI Prediction (30-Day Forecast)</p>
              <select defaultValue="Monthly" className="bg-white/5 border border-white/10 rounded-btn px-2.5 py-1 text-xs text-white outline-none focus:border-brandCyan/40">
                <option value="Weekly" className="bg-[#0c0d12]">Weekly</option>
                <option value="Monthly" className="bg-[#0c0d12]">Monthly</option>
                <option value="Yearly" className="bg-[#0c0d12]">Yearly</option>
              </select>
            </div>
            
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={forecast30Data} margin={{ top:25, right:5, bottom:0, left:-20 }}>
                <defs>
                  <linearGradient id="forecast-aqi-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={meta.color} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={meta.color} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 250]} tick={{ fill:'var(--text-muted)', fontSize:10 }} axisLine={false} tickLine={false}/>
                <Tooltip contentStyle={{ background:'var(--card-bg)', border:'1px solid var(--card-border)', borderRadius:8, color:'var(--text-main)' }}/>
                
                {/* Predicted AQI Trend Area Fill */}
                <Area type="monotone" dataKey="predicted" name="Predicted AQI" stroke={meta.color} strokeWidth={2} fill="url(#forecast-aqi-grad)" dot={<CustomPredictDot color={meta.color} />} activeDot={{ r: 6 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Composition Pie Chart */}
          {reading && (
            <div className="glass-card p-6 flex flex-col justify-between">
              <p className="text-xs text-white/40 uppercase tracking-wide mb-4">Pollutants Sub-AQI Composition</p>
              <div className="flex items-center justify-between gap-4 flex-1">
                <div className="w-[180px] h-[160px] flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={POLLUTANTS.map(({ label, subAqiKey, color }) => ({
                          name: label,
                          value: reading?.[subAqiKey] || 0,
                          color: color
                        })).filter(x => x.value > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={35}
                        outerRadius={55}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {POLLUTANTS.map(({ label, subAqiKey, color }) => {
                          const val = reading?.[subAqiKey] || 0
                          if (val === 0) return null
                          return <Cell key={label} fill={color} />
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ background:'#060913', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'white' }}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-x-3 gap-y-1.5 pl-2 max-w-[200px]">
                  {POLLUTANTS.map(({ label, subAqiKey, color }) => {
                    const val = reading?.[subAqiKey] || 0
                    if (val === 0) return null
                    return (
                      <div key={label} className="flex items-center gap-1.5 text-[10px]">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-white/60 font-semibold truncate">{label}:</span>
                        <span className="text-white/80 font-bold">{val}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Health tip */}
        <div className="glass-card p-5" style={{ borderColor: meta.color + '25' }}>
          <p className="text-xs text-white/40 uppercase tracking-wide mb-2">Health Guidance</p>
          <p className="text-sm text-white/80 leading-relaxed">{getHealthTip(aqi, health?.condition_name)}</p>
        </div>
      </div>
    )
  }

  return (
    <AppShell role="user" onSignOut={onSignOut} activeTab={tab} onTabChange={setTab} theme={theme} toggleTheme={toggleTheme}>
      {renderContent()}
    </AppShell>
  )
}

function PollutantsView({ reading, loading, onRefresh }) {
  if (loading) return <div className="p-8 flex items-center justify-center h-40 text-white/30">Loading…</div>
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white flex items-center gap-2">
          <Wind size={22} className="text-brandCyan"/> Air Quality Detail
        </h1>
        <button onClick={onRefresh} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14}/> Refresh
        </button>
      </div>

      {/* Composition Pie Chart */}
      {reading && (
        <div className="glass-card p-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-xs text-white/40 uppercase tracking-wide mb-2">Pollutant Mass Share</h3>
            <h2 className="text-lg font-black text-white">Concentration Breakdown</h2>
            <p className="text-xs text-white/40 mt-1.5 leading-relaxed">
              This breakdown illustrates the proportional mass concentrations of key pollutants currently measured in your local atmosphere.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 flex-shrink-0">
            <div className="w-[180px] h-[150px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={POLLUTANTS.map(({ label, key, color }) => ({
                      name: label,
                      value: reading?.[key] || 0,
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
                      const val = reading?.[key] || 0
                      if (val === 0) return null
                      return <Cell key={label} fill={color} />
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ background:'#060913', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, color:'white' }}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-col gap-1.5 pl-2 min-w-[120px]">
              {POLLUTANTS.map(({ label, key, unit, color }) => {
                const val = reading?.[key] || 0
                if (val === 0) return null
                return (
                  <div key={label} className="flex items-center gap-1.5 text-[10px]">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-white/60 font-semibold truncate">{label}:</span>
                    <span className="text-white/80 font-bold">{val.toFixed(1)} {unit}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Pollutant Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {POLLUTANTS.map(({ key, subAqiKey, label, unit, limit, color }) => {
          const val = reading?.[key] || 0
          const subAqi = reading?.[subAqiKey] || 0
          const pct = Math.min((val / limit) * 100, 100)
          const status = pct>=100?'Exceeds Limit':pct>=80?'High':pct>=50?'Moderate':'Safe'
          const statusColor = pct>=100?'#FF0000':pct>=80?'#FF7E00':pct>=50?'#FFFF00':'#00E400'
          return (
            <div key={key} className="glass-card p-5" style={{ borderColor: color+'20' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-white">{label}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: statusColor, background: statusColor+'15' }}>
                  {status}
                </span>
              </div>
              <div className="text-3xl font-black mb-1 transition-all duration-300" style={{ color }}>
                {val.toFixed(1)} <span className="text-xs text-white/30 font-medium">{unit}</span>
              </div>
              <div className="text-xs text-white/40 mb-3">
                Sub-AQI: <span className="font-semibold text-white/70">{subAqi}</span>
                <span className="text-white/20"> / limit {limit}</span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500" style={{ width:`${pct}%`, background: color }} />
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
