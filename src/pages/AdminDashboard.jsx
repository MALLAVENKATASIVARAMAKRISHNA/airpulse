import { useCallback, useEffect, useMemo, useState } from 'react'
import { Activity, Check, MapPin, Plus, Radio, Users } from 'lucide-react'
import AppShell from '../components/AppShell'
import AqiGauge from '../components/AqiGauge'
import PollutantCard from '../components/PollutantCard'
import { formatReadingTime, getAqiMeta, pollutantConfig } from '../lib/airQuality'
import { supabase } from '../lib/supabase'

const emptyForm = {
  aqi: 0,
  pm25: 0,
  pm10: 0,
  co: 0,
  nh3: 0,
  sub_aqi_pm25: 0,
  sub_aqi_pm10: 0,
  sub_aqi_co: 0,
  sub_aqi_nh3: 0,
}

export default function AdminDashboard({ profile, onSignOut }) {
  const [nodes, setNodes] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [latestByNode, setLatestByNode] = useState({})
  const [form, setForm] = useState(emptyForm)
  const [userCount, setUserCount] = useState(0)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  const loadDashboard = useCallback(async () => {
    const [nodeResult, readingResult, usersResult] = await Promise.all([
      supabase.from('nodes').select('*').order('location'),
      supabase.from('latest_node_readings').select('*'),
      supabase.from('users').select('*', { count: 'exact', head: true }),
    ])
    const nodeList = nodeResult.data || []
    const latest = Object.fromEntries((readingResult.data || []).map((item) => [item.node_id, item]))
    setNodes(nodeList)
    setLatestByNode(latest)
    setUserCount(usersResult.count || 0)
    setSelectedId((current) => current || nodeList[0]?.node_id || '')
  }, [])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  useEffect(() => {
    if (!selectedId) return
    const reading = latestByNode[selectedId]
    setForm(reading ? pollutantConfig.reduce(
      (result, item) => ({
        ...result,
        [item.key]: reading[item.key] ?? 0,
        [item.subKey]: reading[item.subKey] ?? 0,
      }),
      { ...emptyForm, aqi: reading.aqi ?? 0 },
    ) : emptyForm)
  }, [selectedId, latestByNode])

  const selectedNode = nodes.find((node) => node.node_id === selectedId)
  const selectedReading = latestByNode[selectedId]
  const hotspot = useMemo(
    () => Object.values(latestByNode).sort((a, b) => b.aqi - a.aqi)[0],
    [latestByNode],
  )

  function changeValue(key, value) {
    setForm((current) => ({ ...current, [key]: Number(value) }))
  }

  function increment(key, amount = 1) {
    setForm((current) => ({ ...current, [key]: Math.max(0, Number(current[key]) + amount) }))
  }

  async function applyReading(event) {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    const payload = {
      node_id: selectedId,
      ...form,
      recorded_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('aqi_readings').insert(payload).select().single()
    if (error) {
      setMessage(error.message)
    } else {
      setLatestByNode((current) => ({ ...current, [selectedId]: data }))
      setMessage(`Reading applied to ${selectedNode.location}. Connected users will receive it immediately.`)
    }
    setSaving(false)
  }

  return (
    <AppShell
      role="admin"
      title="Network control center"
      subtitle={`Signed in as ${profile.full_name}. Manage live node readings and alerts.`}
      onSignOut={onSignOut}
    >
      <section className="stat-grid">
        <article className="stat-card"><Radio size={21} /><div><strong>{nodes.length}</strong><span>Active nodes</span></div></article>
        <article className="stat-card"><Users size={21} /><div><strong>{userCount}</strong><span>Registered users</span></div></article>
        <article className="stat-card"><Activity size={21} /><div><strong>{hotspot?.aqi || '—'}</strong><span>Highest network AQI</span></div></article>
        <article className="stat-card"><MapPin size={21} /><div><strong>{hotspot?.location || '—'}</strong><span>Current hotspot</span></div></article>
      </section>

      <div className="admin-layout">
        <section className="node-list card">
          <div className="section-heading">
            <div><p className="eyebrow">Network</p><h2>Monitoring nodes</h2></div>
          </div>
          <div className="node-options">
            {nodes.map((node) => {
              const reading = latestByNode[node.node_id]
              const meta = getAqiMeta(reading?.aqi || 0)
              return (
                <button
                  key={node.node_id}
                  className={`node-option ${selectedId === node.node_id ? 'selected' : ''}`}
                  onClick={() => { setSelectedId(node.node_id); setMessage('') }}
                >
                  <span className="node-dot" style={{ background: meta.color }} />
                  <span><strong>{node.location}</strong><small>{node.node_id} • {node.district}</small></span>
                  <b style={{ color: meta.color }}>{reading?.aqi ?? '—'}</b>
                </button>
              )
            })}
          </div>
        </section>

        <section className="control-panel card">
          <div className="control-header">
            <div>
              <p className="eyebrow">Live reading control</p>
              <h2>{selectedNode?.location || 'Select a node'}</h2>
              <p>Last reading: {formatReadingTime(selectedReading?.recorded_at)}</p>
            </div>
            <AqiGauge value={form.aqi} compact />
          </div>

          <form onSubmit={applyReading}>
            <div className="aqi-control">
              <label>
                Present AQI
                <input type="number" min="0" max="500" value={form.aqi} onChange={(e) => changeValue('aqi', e.target.value)} />
              </label>
              <div className="quick-buttons">
                <button type="button" onClick={() => increment('aqi', 10)}><Plus size={15} />10</button>
                <button type="button" onClick={() => increment('aqi', 25)}><Plus size={15} />25</button>
                <button type="button" onClick={() => increment('aqi', 50)}><Plus size={15} />50</button>
              </div>
            </div>

            <div className="admin-pollutants">
              {pollutantConfig.map((item) => (
                <div className="pollutant-control" key={item.key}>
                  <div><strong>{item.label}</strong><span>{item.unit}</span></div>
                  <label>Value<input type="number" min="0" step="0.01" value={form[item.key]} onChange={(e) => changeValue(item.key, e.target.value)} /></label>
                  <label>Sub-AQI<input type="number" min="0" max="500" value={form[item.subKey]} onChange={(e) => changeValue(item.subKey, e.target.value)} /></label>
                  <button type="button" className="increment-button" onClick={() => increment(item.key, 5)}><Plus size={16} /> 5</button>
                </div>
              ))}
            </div>

            {message && <p className="success-message"><Check size={17} /> {message}</p>}
            <div className="control-actions">
              <p>Applying creates a new timestamped reading. AQI of 200 or higher triggers dashboards assigned to this node.</p>
              <button className="primary-button" disabled={saving || !selectedId}>
                {saving ? 'Applying…' : 'Apply live reading'}
              </button>
            </div>
          </form>
        </section>
      </div>

      {selectedReading && (
        <section className="section-block">
          <div className="section-heading"><div><p className="eyebrow">Current composition</p><h2>Stored node values</h2></div></div>
          <div className="pollutant-grid">
            {pollutantConfig.map((item) => (
              <PollutantCard key={item.key} label={item.label} value={selectedReading[item.key]} unit={item.unit} subAqi={selectedReading[item.subKey]} />
            ))}
          </div>
        </section>
      )}
    </AppShell>
  )
}
