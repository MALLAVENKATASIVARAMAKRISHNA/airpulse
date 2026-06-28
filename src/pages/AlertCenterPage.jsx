import { useEffect, useState } from 'react'
import { Bell, RefreshCw, CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { api } from '../lib/api'

function timeAgo(ts) {
  if (!ts) return '—'
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)   return 'Just now'
  if (m < 60)  return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

export default function AlertCenterPage({ profile }) {
  const [alerts,  setAlerts]  = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const data = await api.alertHistory()
      setAlerts(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const unread = alerts.filter(a => !a.acknowledged).length

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Bell size={22} className="text-brandCyan" /> Alert Centre
          </h1>
          <p className="text-white/40 text-sm mt-1">
            History of AQI alerts sent for your location
            {unread > 0 && <span className="ml-2 text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full">{unread} new</span>}
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading…</div>
      ) : alerts.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <CheckCircle size={40} className="text-brandGreen mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No alerts yet</p>
          <p className="text-white/40 text-sm">You haven't received any AQI alerts. That's a good sign!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert, i) => (
            <div key={i} className="glass-card p-5 flex items-start gap-4">
              <div className="w-10 h-10 rounded-btn flex items-center justify-center flex-shrink-0 bg-red-500/20">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-white">AQI Alert — {alert.location || profile.node_id}</p>
                  <span className="text-[10px] text-white/30">{timeAgo(alert.alerted_at)}</span>
                </div>
                <p className="text-sm text-white/50">
                  AQI reached <span className="text-red-400 font-bold">{alert.aqi}</span> — exceeded your personal safe limit.
                </p>
                {alert.recorded_at && (
                  <p className="text-xs text-white/25 mt-1">{new Date(alert.alerted_at).toLocaleString()}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
