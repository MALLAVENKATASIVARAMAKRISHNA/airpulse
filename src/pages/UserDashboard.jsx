import { useCallback, useEffect, useMemo, useState } from 'react'
import { HeartPulse, MapPin, RefreshCw, Sparkles } from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import AppShell from '../components/AppShell'
import AqiGauge from '../components/AqiGauge'
import DangerAlert from '../components/DangerAlert'
import PollutantCard from '../components/PollutantCard'
import {
  AQI_ALERT_THRESHOLD,
  formatReadingTime,
  getHealthMessage,
  pollutantConfig,
} from '../lib/airQuality'
import { supabase } from '../lib/supabase'

export default function UserDashboard({ profile, health, onSignOut }) {
  const [node, setNode] = useState(null)
  const [readings, setReadings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dismissedReading, setDismissedReading] = useState(
    () => localStorage.getItem(`airpulse-dismissed-${profile.user_id}`),
  )

  const loadData = useCallback(async () => {
    const [nodeResult, readingResult] = await Promise.all([
      supabase.from('nodes').select('*').eq('node_id', profile.node_id).single(),
      supabase
        .from('aqi_readings')
        .select('*')
        .eq('node_id', profile.node_id)
        .order('reading_id', { ascending: false })
        .limit(24),
    ])
    setNode(nodeResult.data)
    setReadings(readingResult.data || [])
    setLoading(false)
  }, [profile.node_id])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel(`node-readings-${profile.node_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'aqi_readings',
          filter: `node_id=eq.${profile.node_id}`,
        },
        (payload) => setReadings((current) => [payload.new, ...current].slice(0, 24)),
      )
      .subscribe()

    // Realtime delivery can be interrupted by browser sleep or a temporary
    // connection loss. Polling and focus refresh keep safety alerts reliable.
    const poll = window.setInterval(loadData, 5000)
    const refreshOnFocus = () => loadData()
    window.addEventListener('focus', refreshOnFocus)
    document.addEventListener('visibilitychange', refreshOnFocus)

    return () => {
      window.clearInterval(poll)
      window.removeEventListener('focus', refreshOnFocus)
      document.removeEventListener('visibilitychange', refreshOnFocus)
      supabase.removeChannel(channel)
    }
  }, [loadData, profile.node_id])

  const current = readings[0]
  const chartData = useMemo(
    () => [...readings].reverse().map((item) => ({
      aqi: item.aqi,
      time: new Date(item.recorded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
    })),
    [readings],
  )
  const showAlert = current?.aqi >= AQI_ALERT_THRESHOLD && String(current.reading_id) !== dismissedReading

  function dismissAlert() {
    const id = String(current.reading_id)
    localStorage.setItem(`airpulse-dismissed-${profile.user_id}`, id)
    setDismissedReading(id)
  }

  return (
    <AppShell
      role="user"
      title={`Good ${new Date().getHours() < 12 ? 'morning' : 'day'}, ${profile.full_name.split(' ')[0]}`}
      subtitle="Here is the air quality around your registered location."
      onSignOut={onSignOut}
    >
      {showAlert && (
        <DangerAlert reading={current} node={node} health={health} onDismiss={dismissAlert} />
      )}

      <div className="location-strip">
        <span><MapPin size={18} /> <strong>{node?.location || 'Loading location'}</strong>, {node?.district}</span>
        <button className="text-button" onClick={loadData}><RefreshCw size={15} /> Refresh</button>
      </div>

      <section className="user-hero card">
        <div>
          <p className="eyebrow">Current air quality</p>
          <AqiGauge value={current?.aqi || 0} />
          <p className="last-updated">Updated {formatReadingTime(current?.recorded_at)}</p>
        </div>
        <div className="health-guidance">
          <span className="guidance-icon"><HeartPulse size={24} /></span>
          <p className="eyebrow">For your health profile</p>
          <h2>{health?.condition_name === 'Asthma' ? 'Asthma-aware guidance' : 'Today’s guidance'}</h2>
          <p>{getHealthMessage(current?.aqi || 0, health?.condition_name, health?.severity_level)}</p>
          <div className="profile-chip">
            {health?.condition_name || 'Normal'} {health?.severity_level !== 'None' && `• ${health?.severity_level}`}
          </div>
        </div>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Composition</p><h2>What is in the air</h2></div>
          <span>Latest sensor values</span>
        </div>
        <div className="pollutant-grid">
          {pollutantConfig.map((item) => (
            <PollutantCard
              key={item.key}
              label={item.label}
              value={current?.[item.key]}
              unit={item.unit}
              subAqi={current?.[item.subKey]}
            />
          ))}
        </div>
      </section>

      <section className="chart-card card">
        <div className="section-heading">
          <div><p className="eyebrow">Trend</p><h2>Recent AQI movement</h2></div>
          <span className="prediction-chip"><Sparkles size={14} /> Prediction coming next</span>
        </div>
        <div className="chart-wrap">
          {loading ? <div className="empty-state">Loading readings…</div> : chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#45d6ae" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#45d6ae" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="time" stroke="#809590" tickLine={false} axisLine={false} />
                <YAxis stroke="#809590" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: '#102822', border: '1px solid #27443d', borderRadius: 12 }} />
                <Area type="monotone" dataKey="aqi" stroke="#45d6ae" strokeWidth={3} fill="url(#aqiFill)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <div className="empty-state">No readings for this node yet.</div>}
        </div>
      </section>
    </AppShell>
  )
}
