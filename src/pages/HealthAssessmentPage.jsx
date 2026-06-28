import { useEffect, useState } from 'react'
import { Heart, RefreshCw, ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import { api } from '../lib/api'

function getThresholds(conditionName, severityLevel, age) {
  const cond = (conditionName || '').toLowerCase()
  const yr   = parseInt(age) || 30
  const infant = yr <= 2, child = yr >= 3 && yr <= 12, teen = yr >= 13 && yr <= 18, elderly = yr >= 60
  let warn, alert

  if (cond.includes('asthma')) {
    if (infant || child) { warn = 100; alert = 200 }
    else if (teen)       { warn = 101; alert = 201 }
    else if (elderly)    { warn = 101; alert = 200 }
    else                 { warn = 151; alert = 301 }
  } else if (cond.includes('copd')) {
    if (elderly)         { warn = 101; alert = 200 }
    else                 { warn = 151; alert = 301 }
  } else if (cond.includes('heart')) {
    if (elderly)         { warn = 101; alert = 200 }
    else                 { warn = 151; alert = 300 }
  } else if (cond.includes('diabetes')) {
    if (elderly)         { warn = 101; alert = 201 }
    else                 { warn = 151; alert = 301 }
  } else if (cond.includes('children')) {
    if (infant)          { warn = 100; alert = 200 }
    else                 { warn = 100; alert = 201 }
  } else if (cond.includes('elderly')) {
    warn = 101; alert = 201
  } else {
    if (infant)          { warn = 100; alert = 200 }
    else if (child)      { warn = 100; alert = 201 }
    else if (teen)       { warn = 101; alert = 301 }
    else if (elderly)    { warn = 101; alert = 201 }
    else                 { warn = 201; alert = 401 }
  }

  const mod = severityLevel === 'High' ? -25 : severityLevel === 'Low' ? 25 : 0
  return { warn: Math.max(50, warn + mod), alert: Math.max(75, alert + mod) }
}

function riskScore(aqi, alertThreshold) {
  if (aqi <= 0) return 100
  const ratio = aqi / alertThreshold
  return Math.max(0, Math.round(100 - ratio * 80))
}

export default function HealthAssessmentPage({ profile, health }) {
  const [reading,  setReading]  = useState(null)
  const [loading,  setLoading]  = useState(true)

  async function load() {
    setLoading(true)
    try {
      const nodes = await api.latestAll()
      const mine  = (nodes || []).find(n => n.node_id === profile.node_id)
      setReading(mine || null)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [profile.node_id])

  if (!health) return null

  const { warn, alert: alertThresh } = getThresholds(health.condition_name, health.severity_level, health.age)
  const aqi   = reading?.aqi || 0
  const score = riskScore(aqi, alertThresh)
  const pct   = Math.min((aqi / alertThresh) * 100, 100)

  const scoreColor = score >= 70 ? '#00E400' : score >= 40 ? '#FFFF00' : '#FF0000'
  const status     = aqi >= alertThresh ? 'Dangerous' : aqi >= warn ? 'Caution' : 'Safe'
  const statusColor= aqi >= alertThresh ? '#FF0000' : aqi >= warn ? '#FFFF00' : '#00E400'

  const safeOutdoor = aqi <= 50 ? 'Unlimited' : aqi <= 100 ? '2 hours' : aqi <= 200 ? '1 hour' : aqi <= 300 ? '30 minutes' : 'Avoid outdoors'

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Heart size={22} className="text-brandCyan" /> Health Assessment
          </h1>
          <p className="text-white/40 text-sm mt-1">Personalised exposure risk based on your health profile</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Health Score */}
          <div className="glass-card p-6 flex flex-col items-center text-center">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Health Score</p>
            <div className="relative w-36 h-36 mb-4">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
                <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="10"
                  strokeDasharray={`${score * 2.64} 264`} strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-black" style={{ color: scoreColor }}>{score}</span>
                <span className="text-xs text-white/40">/100</span>
              </div>
            </div>
            <div className="text-sm font-bold px-3 py-1 rounded-full border" style={{ color: statusColor, borderColor: statusColor + '40', background: statusColor + '15' }}>
              {status}
            </div>
          </div>

          {/* Profile */}
          <div className="glass-card p-6 space-y-4">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide">Your Health Profile</p>
            {[
              ['Condition',  health.condition_name || '—'],
              ['Severity',   health.severity_level || '—'],
              ['Age',        health.age ? `${health.age} years` : '—'],
              ['Gender',     health.gender || '—'],
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between items-center py-2 border-b border-white/5">
                <span className="text-sm text-white/50">{l}</span>
                <span className="text-sm font-semibold text-white">{v}</span>
              </div>
            ))}
          </div>

          {/* AQI vs Thresholds */}
          <div className="glass-card p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">AQI vs Your Threshold</p>
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-4xl font-black text-white">{aqi}</span>
              <span className="text-sm text-white/40">current AQI</span>
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? '#FF0000' : pct >= 70 ? '#FFFF00' : '#00E400' }} />
            </div>
            <div className="flex justify-between text-xs text-white/40 mb-4">
              <span>0</span>
              <span className="text-yellow-400">Warn: {warn}</span>
              <span className="text-red-400">Alert: {alertThresh}</span>
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-btn">
              <Clock size={14} className="text-brandCyan" />
              <div>
                <p className="text-xs text-white/40">Safe outdoor time today</p>
                <p className="text-sm font-bold text-white">{safeOutdoor}</p>
              </div>
            </div>
          </div>

          {/* Status summary */}
          <div className="glass-card p-6">
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-4">Current Status</p>
            <div className="space-y-3">
              {[
                { icon: <ShieldCheck size={16}/>, label: 'Warn threshold', value: `AQI ≥ ${warn}`, color: '#FFFF00' },
                { icon: <AlertTriangle size={16}/>, label: 'Alert threshold', value: `AQI ≥ ${alertThresh}`, color: '#FF0000' },
                { icon: <Heart size={16}/>, label: 'Location', value: reading?.location || '—', color: '#00a2ff' },
              ].map(({ icon, label, value, color }) => (
                <div key={label} className="flex items-center gap-3 p-3 bg-white/5 rounded-btn">
                  <span style={{ color }}>{icon}</span>
                  <div className="flex-1">
                    <p className="text-xs text-white/40">{label}</p>
                    <p className="text-sm font-semibold text-white">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
