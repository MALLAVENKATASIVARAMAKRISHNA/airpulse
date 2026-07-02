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
      <p className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</p>
    </div>
  )
}

export default function ForecastPage({ profile, currentAqi = 0, mlData = null }) {
  const [dbPreds, setDbPreds] = useState([])
  const [loading, setLoading] = useState(true)

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
    { label: 'Now',  aqi: currentAqi   },
    { label: '+6h',  aqi: preds['6h']  },
    { label: '+24h', aqi: preds['24h'] },
    { label: '+48h', aqi: preds['48h'] },
  ] : []

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <TrendingUp size={22} className="text-brandCyan" /> AQI Forecast
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/40 text-sm">AI-powered predictions · GradientBoosting model</p>
            {isLive && (
              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">
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
          <div className="glass-card p-6 mb-6">
            <h3 className="text-xs text-white/40 uppercase tracking-widest mb-6">AQI Forecast Timeline</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <ReferenceArea y1={0}   y2={50}  fill="#00E400" fillOpacity={0.05} />
                <ReferenceArea y1={50}  y2={100} fill="#76C442" fillOpacity={0.05} />
                <ReferenceArea y1={100} y2={200} fill="#FFFF00" fillOpacity={0.05} />
                <ReferenceArea y1={200} y2={300} fill="#FF7E00" fillOpacity={0.05} />
                <ReferenceArea y1={300} y2={400} fill="#FF0000" fillOpacity={0.05} />
                <ReferenceArea y1={400} y2={500} fill="#8F3F97" fillOpacity={0.05} />
                <XAxis dataKey="label" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, maxAqi]} tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 11 }} axisLine={false} tickLine={false} width={35} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="aqi" stroke="rgba(255,255,255,0.25)" strokeWidth={2} strokeDasharray="6 3" dot={<CustomDot />} activeDot={false} />
              </LineChart>
            </ResponsiveContainer>
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-3 justify-center">
              {[['#00E400','Good'],['#76C442','Satisfactory'],['#FFFF00','Moderate'],['#FF7E00','Poor'],['#FF0000','Very Poor'],['#8F3F97','Severe']].map(([c,l]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: c }} />
                  <span className="text-[10px] text-white/30">{l}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Horizon cards */}
          <div className="grid grid-cols-3 gap-4">
            {['6h','24h','48h'].map(h => {
              const val  = preds[h]
              const meta = val !== null ? aqiMeta(val) : null
              const diff = val - currentAqi
              const trend = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
              const trendColor = diff > 0 ? '#FF7E00' : diff < 0 ? '#00E400' : '#76C442'
              return (
                <div key={h} className="glass-card p-6 text-center" style={meta ? { borderColor: meta.color + '30' } : {}}>
                  <div className="flex items-center justify-center gap-1.5 mb-3">
                    <Clock size={13} className="text-white/40" />
                    <span className="text-xs font-bold text-white/40 uppercase tracking-widest">{h} ahead</span>
                  </div>
                  <div className="text-5xl font-black mb-1" style={{ color: meta?.color }}>{val ?? '—'}</div>
                  {meta && <div className="text-xs font-semibold px-2 py-1 rounded-full inline-block mb-2" style={{ color: meta.color, background: meta.bg }}>{meta.label}</div>}
                  {val !== null && currentAqi > 0 && (
                    <div className="text-xs font-bold mt-1" style={{ color: trendColor }}>
                      {trend} {Math.abs(diff)} from now
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
