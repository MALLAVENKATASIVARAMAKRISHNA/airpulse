import { useEffect, useState } from 'react'
import { ShieldCheck, Wind, Home, Umbrella, Activity, AlertTriangle, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'

function getTips(aqi, condition) {
  const cond = (condition || '').toLowerCase()
  const base = []

  if (aqi <= 50) {
    base.push({ icon: <Activity size={18}/>, title: 'Great day for outdoor activities', desc: 'Air quality is good. Enjoy outdoor exercise freely.', color: '#00E400' })
    base.push({ icon: <Wind size={18}/>, title: 'Ventilate your home', desc: 'Open windows to let fresh air in — ideal conditions today.', color: '#00E400' })
  } else if (aqi <= 100) {
    base.push({ icon: <Activity size={18}/>, title: 'Outdoor activity is generally fine', desc: 'Sensitive individuals should limit prolonged exertion.', color: '#76C442' })
    base.push({ icon: <Wind size={18}/>, title: 'Moderate ventilation', desc: 'Ventilate during cooler parts of the day.', color: '#76C442' })
  } else if (aqi <= 200) {
    base.push({ icon: <Umbrella size={18}/>, title: 'Wear a mask outdoors', desc: 'An N95 mask provides good protection at this AQI level.', color: '#FFFF00' })
    base.push({ icon: <Activity size={18}/>, title: 'Limit outdoor exertion', desc: 'Avoid heavy exercise outdoors. Prefer indoor workouts today.', color: '#FFFF00' })
    base.push({ icon: <Home size={18}/>, title: 'Keep windows partially closed', desc: 'Use indoor air filtration if available.', color: '#FFFF00' })
  } else if (aqi <= 300) {
    base.push({ icon: <AlertTriangle size={18}/>, title: 'Stay indoors as much as possible', desc: 'Everyone should reduce outdoor activity at this level.', color: '#FF7E00' })
    base.push({ icon: <Umbrella size={18}/>, title: 'N95 mask mandatory outdoors', desc: 'Do not go out without proper respiratory protection.', color: '#FF7E00' })
    base.push({ icon: <Home size={18}/>, title: 'Keep all windows closed', desc: 'Run air purifier on high setting indoors.', color: '#FF7E00' })
  } else {
    base.push({ icon: <AlertTriangle size={18}/>, title: 'Stay indoors — Emergency level', desc: 'Hazardous air quality. Do not go outdoors unless absolutely necessary.', color: '#FF0000' })
    base.push({ icon: <Home size={18}/>, title: 'Seal gaps in windows and doors', desc: 'Prevent outdoor air from entering. Run air purifier continuously.', color: '#FF0000' })
    base.push({ icon: <ShieldCheck size={18}/>, title: 'Seek medical help if unwell', desc: 'Chest tightness, coughing, or difficulty breathing requires immediate attention.', color: '#FF0000' })
  }

  // Condition-specific tips
  if (cond.includes('asthma') && aqi > 100) {
    base.unshift({ icon: <ShieldCheck size={18}/>, title: 'Asthma precaution', desc: 'Keep rescue inhaler accessible at all times. Follow your asthma action plan.', color: '#00a2ff' })
  }
  if (cond.includes('copd') && aqi > 100) {
    base.unshift({ icon: <ShieldCheck size={18}/>, title: 'COPD precaution', desc: 'Avoid all exertion. Use your bronchodilator as prescribed. Contact your doctor if symptoms worsen.', color: '#00a2ff' })
  }
  if (cond.includes('heart') && aqi > 100) {
    base.unshift({ icon: <ShieldCheck size={18}/>, title: 'Cardiovascular precaution', desc: 'High pollution increases heart attack and stroke risk. Avoid all physical exertion outdoors.', color: '#00a2ff' })
  }
  if ((cond.includes('children') || parseInt(cond) <= 12) && aqi > 100) {
    base.unshift({ icon: <ShieldCheck size={18}/>, title: 'Children precaution', desc: 'Children are more vulnerable. Cancel outdoor sports and play. Keep them indoors.', color: '#00a2ff' })
  }

  return base
}

export default function RecommendationsPage({ profile, health }) {
  const [reading,  setReading]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    try {
      const nodes = await api.latestAll()
      setReading((nodes || []).find(n => n.node_id === profile.node_id) || null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [profile.node_id])

  const aqi  = reading?.aqi || 0
  const tips = getTips(aqi, health?.condition_name)

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ShieldCheck size={22} className="text-brandCyan" /> Health Advice
          </h1>
          <p className="text-white/40 text-sm mt-1">Personalised recommendations based on your condition and current AQI</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* AQI badge */}
      <div className="glass-card p-5 flex items-center gap-4 mb-6">
        <div>
          <p className="text-xs text-white/40 uppercase tracking-wide">Current AQI at {reading?.location || '—'}</p>
          <p className="text-4xl font-black text-white mt-1">{aqi}</p>
        </div>
        {health && (
          <div className="ml-auto text-right">
            <p className="text-xs text-white/40">Your condition</p>
            <p className="text-sm font-bold text-white">{health.condition_name}</p>
            <p className="text-xs text-white/40">{health.severity_level} severity · {health.age}y</p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading…</div>
      ) : (
        <div className="space-y-3">
          {tips.map((tip, i) => (
            <div key={i} className="glass-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-btn flex items-center justify-center flex-shrink-0" style={{ background: tip.color + '20', color: tip.color }}>
                {tip.icon}
              </div>
              <div>
                <p className="text-sm font-bold text-white mb-1">{tip.title}</p>
                <p className="text-sm text-white/50 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
