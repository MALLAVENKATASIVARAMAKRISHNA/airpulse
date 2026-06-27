import { useState } from 'react'
import { Activity, ArrowRight, HeartPulse } from 'lucide-react'
import Logo from '../components/Logo'
import { api } from '../lib/api'

export default function HealthOnboarding({ profile, conditions, onComplete }) {
  const normalId = conditions.find(c => c.condition_name === 'Normal')?.condition_id
  const [form, setForm] = useState({ conditionId: normalId || '', severity: 'None', age: '', gender: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const selected = conditions.find(c => String(c.condition_id) === String(form.conditionId))

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.saveHealth({
        condition_id:   Number(form.conditionId),
        severity_level: selected?.condition_name === 'Normal' ? 'None' : form.severity,
        age:            Number(form.age),
        gender:         form.gender,
      })
      onComplete()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <main className="onboarding-page">
      <header><Logo /></header>
      <section className="onboarding-card">
        <span className="step-pill">One last step</span>
        <div className="onboarding-icon"><HeartPulse size={28} /></div>
        <h1>Personalize your health guidance</h1>
        <p>This information helps AirPulse provide alerts appropriate to your health profile.</p>
        <form onSubmit={submit}>
          <label>
            Health condition
            <select value={form.conditionId} onChange={e => setForm({ ...form, conditionId: e.target.value })} required>
              <option value="" disabled>Select a condition</option>
              {conditions.map(c => <option key={c.condition_id} value={c.condition_id}>{c.condition_name}</option>)}
            </select>
          </label>
          {selected?.condition_name !== 'Normal' && (
            <label>
              Severity
              <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} required>
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
            </label>
          )}
          <div className="two-fields">
            <label>Age<input type="number" min="1" max="120" value={form.age} onChange={e => setForm({ ...form, age: e.target.value })} required /></label>
            <label>
              Gender
              <select value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })} required>
                <option value="" disabled>Select</option>
                <option>Female</option>
                <option>Male</option>
                <option>Non-binary</option>
                <option>Prefer not to say</option>
              </select>
            </label>
          </div>
          <p className="privacy-note"><Activity size={17} /> Used only to personalize AirPulse guidance.</p>
          {error && <p className="form-message">{error}</p>}
          <button className="primary-button" disabled={loading}>
            {loading ? 'Saving…' : 'Complete setup'} <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  )
}
