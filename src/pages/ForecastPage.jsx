import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceArea } from 'recharts'
import { TrendingUp, Clock, Zap } from 'lucide-react'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400', bg: 'rgba(0,228,0,0.1)' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442', bg: 'rgba(118,196,66,0.1)' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00', bg: 'rgba(255,255,0,0.1)' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00', bg: 'rgba(255,126,0,0.1)' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000', bg: 'rgba(255,0,0,0.1)' }
  return               { label: 'Severe',         color: '#8F3F97', bg: 'rgba(143,63,151,0.1)' }
}

function CustomDot(props) {
  const { cx, cy, payload } = props
  if (!payload?.aqi) return null
  const meta = aqiMeta(payload.aqi)
  return <circle cx={cx} cy={cy} r={7} fill={meta.color} stroke="#0a0f1e" strokeWidth={2} />
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { label, aqi } = payload[0].payload
  const meta = aqiMeta(aqi)
  return (
    <div className="glass-card px-4 py-3 text-sm border border-white/10">
      <p className="text-white/50 mb-1">{label}</p>
      <p className="text-2xl font-black" style={{ color: meta.color }}>{aqi}</p>
    </div>
  )
}

function formatForecastTime(horizon, predictedFor = null) {
  let date
  if (predictedFor) {
    const t = /Z|[+-]\d{2}:\d{2}$/.test(predictedFor) ? predictedFor : predictedFor + 'Z'
    date = new Date(t)
  } else {
    const hours = horizon === '6h' ? 6 : horizon === '24h' ? 24 : horizon === '48h' ? 48 : 0
    date = new Date(Date.now() + hours * 60 * 60 * 1000)
  }

  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  
  if (horizon === 'Now') {
    return `Now (${timeStr})`
  }

  const today = new Date()
  const isToday = date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()
  
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)
  const isTomorrow = date.getDate() === tomorrow.getDate() && date.getMonth() === tomorrow.getMonth() && date.getFullYear() === tomorrow.getFullYear()

  if (isToday) {
    return timeStr
  } else if (isTomorrow) {
    return `Tomorrow ${timeStr}`
  } else {
    const dayName = date.toLocaleDateString([], { weekday: 'short' })
    return `${dayName} ${timeStr}`
  }
}

export default function ForecastPage({ profile, currentAqi = 0, mlData = null, health = null }) {
  const [dbPreds, setDbPreds] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHorizon, setSelectedHorizon] = useState('Now')

  useEffect(() => {
    api.predictions(profile.node_id)
      .then(p => { setDbPreds(p || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [profile.node_id])

  const preds = mlData?.predictions || {
    '6h':  dbPreds.find(x => x.horizon === '6h')?.predicted_aqi  ?? null,
    '24h': dbPreds.find(x => x.horizon === '24h')?.predicted_aqi ?? null,
    '48h': dbPreds.find(x => x.horizon === '48h')?.predicted_aqi ?? null,
  }

  const isLive  = !!mlData
  const hasData = preds['6h'] !== null
  const maxAqi  = hasData ? Math.min(500, Math.max(currentAqi, preds['6h'], preds['24h'], preds['48h']) + 50) : 300

  const chartData = hasData ? [
    { label: formatForecastTime('Now'), aqi: currentAqi   },
    { label: formatForecastTime('6h',  isLive ? null : dbPreds.find(x => x.horizon === '6h')?.predicted_for),  aqi: preds['6h']  },
    { label: formatForecastTime('24h', isLive ? null : dbPreds.find(x => x.horizon === '24h')?.predicted_for), aqi: preds['24h'] },
    { label: formatForecastTime('48h', isLive ? null : dbPreds.find(x => x.horizon === '48h')?.predicted_for), aqi: preds['48h'] },
  ] : []

  const selectedAqi = selectedHorizon === 'Now' ? currentAqi : (preds[selectedHorizon] ?? currentAqi)
  const thresh = health ? getPersonalThreshold(health) : 200

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-brandCyan" /> AQI Forecast
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/40 text-sm">AI-powered predictions · GradientBoosting model</p>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full animate-pulse">
                <Zap size={10} /> Live from Lambda
              </span>
            )}
          </div>
        </div>
      </div>

      {loading && !hasData ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading forecasts…</div>
      ) : !hasData ? (
        <div className="glass-card p-8 text-center">
          <TrendingUp size={40} className="text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">No forecast data yet.</p>
          <p className="text-white/30 text-xs mt-1">Run the ML pipeline to generate predictions.</p>
        </div>
      ) : (
        <>
          {/* Forecast graph */}
          <div className="glass-card p-6">
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-6">AQI Forecast Timeline</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <ReferenceArea y1={0}   y2={50}  fill="#00E400" fillOpacity={0.04} />
                <ReferenceArea y1={50}  y2={100} fill="#76C442" fillOpacity={0.04} />
                <ReferenceArea y1={100} y2={200} fill="#FFFF00" fillOpacity={0.04} />
                <ReferenceArea y1={200} y2={300} fill="#FF7E00" fillOpacity={0.04} />
                <ReferenceArea y1={300} y2={400} fill="#FF0000" fillOpacity={0.04} />
                <ReferenceArea y1={400} y2={500} fill="#8F3F97" fillOpacity={0.04} />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, maxAqi]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="aqi" stroke="rgba(255,255,255,0.25)" strokeWidth={2.5} strokeDasharray="6 3" dot={<CustomDot />} activeDot={{ r: 8 }} />
              </LineChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-4 justify-center border-t border-white/5 pt-3">
              {[['#00E400','Good'],['#76C442','Satisfactory'],['#FFFF00','Moderate'],['#FF7E00','Poor'],['#FF0000','Very Poor'],['#8F3F97','Severe']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: c }} />
                  <span className="text-[10px] text-white/40 font-semibold">{l}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-white/30 text-center mt-3 font-medium">💡 Tip: Click on a forecast card below to view your personalized health projection at that hour.</p>
          </div>

          {/* Horizon cards */}
          <div className="grid grid-cols-3 gap-4">
            {['6h','24h','48h'].map(h => {
              const val  = preds[h]
              const meta = val !== null ? aqiMeta(val) : null
              const diff = val - currentAqi
              const trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
              const trendColor = diff > 0 ? '#FF7E00' : diff < 0 ? '#00E400' : '#76C442'
              const isActive = selectedHorizon === h

              return (
                <button
                  key={h}
                  onClick={() => setSelectedHorizon(isActive ? 'Now' : h)}
                  className={`glass-card p-6 text-center transition-all duration-300 relative overflow-hidden flex flex-col items-center justify-center
                    ${isActive 
                      ? 'border-brandCyan/60 bg-brandBlue/10 shadow-[0_0_20px_rgba(0,162,255,0.1)] scale-[1.02]' 
                      : 'hover:border-white/20 hover:-translate-y-1'
                    }`}
                  style={meta ? { borderColor: isActive ? undefined : meta.color + '20' } : {}}
                >
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <Clock size={13} className={isActive ? 'text-brandCyan' : 'text-white/40'} />
                    <span className={`text-xs font-bold uppercase tracking-widest ${isActive ? 'text-brandCyan' : 'text-white/40'}`}>
                      {h} forecast
                    </span>
                  </div>
                  <div className="text-5xl font-black mb-2 transition-transform duration-300 group-hover:scale-105" style={{ color: meta?.color }}>
                    {val ?? '—'}
                  </div>
                  {meta && (
                    <div className="text-xs font-semibold px-2.5 py-0.5 rounded-full inline-block mb-3" style={{ color: meta.color, background: meta.bg }}>
                      {meta.label}
                    </div>
                  )}
                  {val !== null && currentAqi > 0 && (
                    <div className="text-xs font-bold" style={{ color: trendColor }}>
                      {trend} {Math.abs(diff)} from now
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Future Health Projection Details */}
          <div className="glass-card p-6 hover:shadow-[0_0_30px_rgba(0,106,255,0.06)] transition-all duration-500 border-l-4" 
               style={{ borderLeftColor: aqiMeta(selectedAqi).color }}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-white/40 uppercase tracking-widest font-semibold">Forecast Analysis</p>
                <h3 className="text-lg font-black text-white mt-1">
                  Health Projection: {selectedHorizon === 'Now' ? 'Current Time' : `${selectedHorizon} Forecast`}
                </h3>
              </div>
              <div className="text-right">
                <span className="text-3xl font-black" style={{ color: aqiMeta(selectedAqi).color }}>{selectedAqi}</span>
                <span className="text-xs block font-bold" style={{ color: aqiMeta(selectedAqi).color }}>{aqiMeta(selectedAqi).label}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
              <div>
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Exposure Guidelines</h4>
                <div className="space-y-3">
                  {getFutureAdvice(selectedAqi, health?.condition_name).map((tip, idx) => (
                    <div key={idx} className="flex gap-3 text-sm text-white/80 leading-relaxed items-start">
                      <span className="text-brandCyan text-xs mt-1">✦</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-3">Health Profile Status</h4>
                <div className="p-4 bg-white/5 rounded-[12px] space-y-2 border border-white/5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-white/40">Registered Profile:</span>
                    <span className="font-semibold text-white">{health?.condition_name || 'Normal / Healthy'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-white/40">Condition Severity:</span>
                    <span className="font-semibold text-white">{health?.severity_level || 'None'}</span>
                  </div>
                  {health && (
                    <div className="flex justify-between">
                      <span className="text-white/40">Personal Safe Threshold:</span>
                      <span className="font-semibold text-red-400">AQI &lt; {thresh}</span>
                    </div>
                  )}
                </div>
                {selectedAqi >= thresh && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-btn text-xs font-semibold flex items-center gap-2 animate-pulse">
                    <span>⚠️</span>
                    <span>Forecasted AQI exceeds your safe exposure limit. Stay indoors.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function getPersonalThreshold(health) {
  if (!health) return 200
  const cond = (health.condition_name || '').toLowerCase()
  const yr = parseInt(health.age) || 30
  const infant = yr <= 2, child = yr >= 3 && yr <= 12, elderly = yr >= 60
  let alert = 200
  if (cond.includes('asthma')) {
    alert = (infant || child || elderly) ? 200 : 301
  } else if (cond.includes('copd') || cond.includes('heart') || cond.includes('diabetes')) {
    alert = elderly ? 200 : 300
  }
  const mod = health.severity_level === 'High' ? -25 : health.severity_level === 'Low' ? 25 : 0
  return Math.max(75, alert + mod)
}

function getFutureAdvice(aqi, condition) {
  const cond = (condition || '').toLowerCase()
  const tips = []
  
  if (aqi <= 50) {
    tips.push('Excellent air quality. Safe to engage in outdoor exercise.')
    tips.push('Open windows to let fresh outdoor air ventilate your rooms.')
  } else if (aqi <= 100) {
    tips.push('Satisfactory air quality. Most people can exercise outdoors freely.')
    if (cond.includes('asthma')) {
      tips.push('Asthma profile: Keep inhaler accessible during extended outdoor exertion.')
    } else {
      tips.push('Sensitive individuals should monitor for minor respiratory irritation.')
    }
  } else if (aqi <= 200) {
    tips.push('Moderate pollution. Consider limiting extended high-effort outdoor activity.')
    tips.push('Commute in off-peak traffic hours to reduce exhaust exposure.')
    if (cond.includes('asthma') || cond.includes('copd') || cond.includes('heart')) {
      tips.push('Medical Precaution: Keep rescue medications handy and limit physical strain.')
    }
  } else if (aqi <= 300) {
    tips.push('Poor air quality. Avoid prolonged or heavy outdoor exposure.')
    tips.push('An N95 respirator mask is recommended for any necessary outdoor activity.')
    tips.push('Keep windows closed and run indoor air purifiers on high setting.')
  } else {
    tips.push('Severe air pollution. Stay indoors and seal all room ventilation.')
    tips.push('Run air filtration continuously. Keep rescue medications nearby.')
    tips.push('Consult a doctor if you experience chest tightness, coughing, or shortness of breath.')
  }
  return tips
}
