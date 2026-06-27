import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity, Check, MapPin, Pause, Play,
  Plus, Radio, RefreshCw, Search, Users,
} from 'lucide-react'
import AppShell from '../components/AppShell'
import AqiGauge from '../components/AqiGauge'
import PollutantCard from '../components/PollutantCard'
import { formatReadingTime, getAqiMeta, pollutantConfig } from '../lib/airQuality'
import { api } from '../lib/api'

// ── Overview tab ─────────────────────────────────────────────
function OverviewTab({ nodes, latestByNode, userCount }) {
  const hotspot = useMemo(
    () => Object.values(latestByNode).sort((a, b) => b.aqi - a.aqi)[0],
    [latestByNode],
  )

  return (
    <>
      <section className="stat-grid">
        <article className="stat-card"><Radio size={21} /><div><strong>{nodes.length}</strong><span>Active nodes</span></div></article>
        <article className="stat-card"><Users size={21} /><div><strong>{userCount}</strong><span>Registered users</span></div></article>
        <article className="stat-card"><Activity size={21} /><div><strong>{hotspot?.aqi ?? '—'}</strong><span>Highest AQI</span></div></article>
        <article className="stat-card"><MapPin size={21} /><div><strong>{hotspot?.location || '—'}</strong><span>Current hotspot</span></div></article>
      </section>

      <div className="node-grid">
        {nodes.map((node) => {
          const r    = latestByNode[node.node_id]
          const meta = getAqiMeta(r?.aqi || 0)
          return (
            <article key={node.node_id} className="node-card card">
              <div className="node-card-top">
                <span className="node-dot" style={{ background: meta.color }} />
                <span className="node-id-badge">{node.node_id}</span>
              </div>
              <strong>{node.location}</strong>
              <p>{node.district}</p>
              <div className="node-aqi" style={{ color: meta.color }}>
                <span>{r?.aqi ?? '—'}</span>
                <small>{meta.label}</small>
              </div>
              {r && <p className="node-card-time">{formatReadingTime(r.recorded_at)}</p>}
            </article>
          )
        })}
      </div>
    </>
  )
}

// ── Nodes tab ────────────────────────────────────────────────
const emptyForm = {
  aqi: 0, pm25: 0, pm10: 0, co: 0, nh3: 0,
  sub_aqi_pm25: 0, sub_aqi_pm10: 0, sub_aqi_co: 0, sub_aqi_nh3: 0,
}

function NodesTab({ nodes, latestByNode, onReadingApplied }) {
  const [selectedId, setSelectedId] = useState(nodes[0]?.node_id || '')
  const [form, setForm]             = useState(emptyForm)
  const [saving, setSaving]         = useState(false)
  const [message, setMessage]       = useState('')

  useEffect(() => {
    const r = latestByNode[selectedId]
    setForm(r
      ? pollutantConfig.reduce(
          (acc, item) => ({ ...acc, [item.key]: r[item.key] ?? 0, [item.subKey]: r[item.subKey] ?? 0 }),
          { ...emptyForm, aqi: r.aqi ?? 0 },
        )
      : emptyForm)
  }, [selectedId, latestByNode])

  const selectedNode    = nodes.find(n => n.node_id === selectedId)
  const selectedReading = latestByNode[selectedId]

  function changeValue(key, val) { setForm(f => ({ ...f, [key]: Number(val) })) }
  function increment(key, amt = 1) { setForm(f => ({ ...f, [key]: Math.max(0, Number(f[key]) + amt) })) }

  async function applyReading(e) {
    e.preventDefault()
    setSaving(true); setMessage('')
    try {
      await api.insertReading({ node_id: selectedId, ...form, recorded_at: new Date().toISOString() })
      onReadingApplied?.()
      setMessage(`Reading applied to ${selectedNode?.location}. Users on this node will see it immediately.`)
    } catch (err) { setMessage(err.message) }
    setSaving(false)
  }

  return (
    <div className="admin-layout">
      <section className="node-list card">
        <div className="section-heading"><div><p className="eyebrow">Network</p><h2>Nodes</h2></div></div>
        <div className="node-options">
          {nodes.map((node) => {
            const r    = latestByNode[node.node_id]
            const meta = getAqiMeta(r?.aqi || 0)
            return (
              <button
                key={node.node_id}
                className={`node-option ${selectedId === node.node_id ? 'selected' : ''}`}
                onClick={() => { setSelectedId(node.node_id); setMessage('') }}
              >
                <span className="node-dot" style={{ background: meta.color }} />
                <span><strong>{node.location}</strong><small>{node.node_id} · {node.district}</small></span>
                <b style={{ color: meta.color }}>{r?.aqi ?? '—'}</b>
              </button>
            )
          })}
        </div>
      </section>

      <div>
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
              <label>Present AQI<input type="number" min="0" max="500" value={form.aqi} onChange={e => changeValue('aqi', e.target.value)} /></label>
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
                  <label>Value<input type="number" min="0" step="0.01" value={form[item.key]} onChange={e => changeValue(item.key, e.target.value)} /></label>
                  <label>Sub-AQI<input type="number" min="0" max="500" value={form[item.subKey]} onChange={e => changeValue(item.subKey, e.target.value)} /></label>
                  <button type="button" className="increment-button" onClick={() => increment(item.key, 5)}><Plus size={16} /> 5</button>
                </div>
              ))}
            </div>

            {message && <p className="success-message"><Check size={17} /> {message}</p>}
            <div className="control-actions">
              <p>Creates a new timestamped reading. AQI ≥ 200 triggers alerts for users on this node.</p>
              <button className="primary-button" disabled={saving || !selectedId}>
                {saving ? 'Applying…' : 'Apply live reading'}
              </button>
            </div>
          </form>
        </section>

        {selectedReading && (
          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">Current composition</p><h2>Stored values</h2></div></div>
            <div className="pollutant-grid">
              {pollutantConfig.map((item) => (
                <PollutantCard key={item.key} label={item.label} value={selectedReading[item.key]} unit={item.unit} subAqi={selectedReading[item.subKey]} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

// ── Users tab ────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers]     = useState([])
  const [search, setSearch]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.users().then(data => { setUsers(data || []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const filtered = users.filter(u =>
    !search ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <section className="card users-panel">
      <div className="users-header">
        <div><p className="eyebrow">Registry</p><h2>Registered users</h2></div>
        <div className="search-box">
          <Search size={16} />
          <input placeholder="Search name or email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      {loading ? (
        <div className="empty-state" style={{ height: 200 }}>Loading users…</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Node</th><th>Phone</th><th>Role</th></tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.user_id}>
                  <td><strong>{u.full_name}</strong></td>
                  <td>{u.email}</td>
                  <td>{u.node_id}</td>
                  <td>{u.phone_number || '—'}</td>
                  <td><span className={`role-tag ${u.role}`}>{u.role}</span></td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={5} className="table-empty">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

// ── Simulation tab ───────────────────────────────────────────
function SimulationTab({ nodes }) {
  const [status, setStatus]         = useState({ running: false, interval: 30, overrides: {}, log: [] })
  const [intervalSecs, setIntervalSecs] = useState(30)
  const [nodeAqi, setNodeAqi]       = useState({})
  const [busy, setBusy]             = useState(false)

  const loadStatus = useCallback(async () => {
    try { setStatus(await api.simStatus()) } catch (_) {}
  }, [])

  useEffect(() => {
    loadStatus()
    const poll = window.setInterval(loadStatus, 5000)
    return () => window.clearInterval(poll)
  }, [loadStatus])

  async function toggleSim() {
    setBusy(true)
    try {
      if (status.running) await api.simStop()
      else await api.simStart(intervalSecs)
      await loadStatus()
    } catch (_) {}
    setBusy(false)
  }

  async function applyOverride(nodeId) {
    const aqi = Number(nodeAqi[nodeId])
    if (!aqi) return
    await api.simOverride(nodeId, { aqi })
    await loadStatus()
  }

  async function resetOverride(nodeId) {
    await api.simReset(nodeId)
    setNodeAqi(p => ({ ...p, [nodeId]: '' }))
    await loadStatus()
  }

  return (
    <>
      <div className="sim-top">
        <section className="card sim-controls">
          <p className="eyebrow">Engine</p>
          <h2>Simulation control</h2>
          <p>Generates realistic AQI readings for all nodes at the configured interval. Override individual nodes to test alert thresholds.</p>
          <div className="sim-status-row">
            <span className={`sim-badge ${status.running ? 'running' : ''}`}>
              <span />{status.running ? `Running · every ${status.interval}s` : 'Stopped'}
            </span>
          </div>
          <label className="sim-interval-label">
            Interval (seconds)
            <input type="number" min="10" max="300" value={intervalSecs} onChange={e => setIntervalSecs(Number(e.target.value))} disabled={status.running} />
          </label>
          <button className={`primary-button sim-toggle ${status.running ? 'stop' : ''}`} onClick={toggleSim} disabled={busy}>
            {status.running ? <><Pause size={17} /> Stop simulation</> : <><Play size={17} /> Start simulation</>}
          </button>
        </section>

        <section className="card sim-overrides">
          <p className="eyebrow">Override</p>
          <h2>Per-node AQI</h2>
          <p>Pin a node's AQI to a fixed value. Values ≥ 200 trigger user alerts. Reset returns to auto-generated values.</p>
          <div className="override-table">
            {nodes.map((node) => {
              const cur = status.overrides?.[node.node_id]
              return (
                <div key={node.node_id} className="override-row">
                  <span className="override-name">
                    <strong>{node.location}</strong>
                    {cur?.aqi != null && <small>· pinned {cur.aqi}</small>}
                  </span>
                  <input
                    type="number" min="0" max="500" placeholder="AQI"
                    value={nodeAqi[node.node_id] ?? ''}
                    onChange={e => setNodeAqi(p => ({ ...p, [node.node_id]: e.target.value }))}
                  />
                  <button className="override-apply" onClick={() => applyOverride(node.node_id)}>Set</button>
                  {cur && <button className="override-reset" onClick={() => resetOverride(node.node_id)}>Reset</button>}
                </div>
              )
            })}
          </div>
        </section>
      </div>

      <section className="card sim-log">
        <div className="sim-log-header">
          <div><p className="eyebrow">Activity</p><h2>Live reading log</h2></div>
          <button className="text-button" onClick={loadStatus}><RefreshCw size={15} /> Refresh</button>
        </div>
        <div className="log-entries">
          {!status.log.length && (
            <div className="empty-state" style={{ height: 120 }}>No readings yet — start the simulation.</div>
          )}
          {status.log.map((entry, i) => {
            const meta = getAqiMeta(entry.aqi)
            return (
              <div key={i} className="log-entry">
                <code className="log-time">{entry.time}</code>
                <strong>{entry.name}</strong>
                <span style={{ color: meta.color }}>{entry.aqi} AQI · {entry.dominant}</span>
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

// ── Main dashboard ───────────────────────────────────────────
export default function AdminDashboard({ profile, onSignOut }) {
  const [activeTab, setActiveTab]       = useState('overview')
  const [nodes, setNodes]               = useState([])
  const [latestByNode, setLatestByNode] = useState({})
  const [userCount, setUserCount]       = useState(0)

  const loadDashboard = useCallback(async () => {
    const [nodeData, latestData, countData] = await Promise.all([
      api.nodes().catch(() => []),
      api.latestAll().catch(() => []),
      api.userCount().catch(() => ({ count: 0 })),
    ])
    setNodes(nodeData || [])
    setLatestByNode(Object.fromEntries((latestData || []).map(r => [r.node_id, r])))
    setUserCount(countData?.count || 0)
  }, [])

  useEffect(() => {
    loadDashboard()
    const poll = window.setInterval(loadDashboard, 15000)
    return () => window.clearInterval(poll)
  }, [loadDashboard])

  return (
    <AppShell
      role="admin"
      title="Network control center"
      subtitle={`Signed in as ${profile.full_name} · ${nodes.length} active nodes`}
      onSignOut={onSignOut}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === 'overview'   && <OverviewTab nodes={nodes} latestByNode={latestByNode} userCount={userCount} />}
      {activeTab === 'nodes'      && <NodesTab nodes={nodes} latestByNode={latestByNode} onReadingApplied={loadDashboard} />}
      {activeTab === 'users'      && <UsersTab />}
      {activeTab === 'simulation' && <SimulationTab nodes={nodes} />}
    </AppShell>
  )
}
