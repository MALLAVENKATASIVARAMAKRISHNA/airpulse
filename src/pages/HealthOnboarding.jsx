import { useState } from 'react'
import { ChevronRight, User } from 'lucide-react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

export default function HealthOnboarding({ profile, conditions, onComplete }) {
  const [form, setForm]       = useState({ condition_id: '', severity_level: 'Medium', age: '', gender: 'Male' })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await api.saveHealth({ ...form, age: parseInt(form.age) || 30 })
      onComplete()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-darkBg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="mesh-glow-blue" />
      <div className="mesh-glow-green" />

      <div className="relative z-10 w-full max-w-lg">
        <div className="flex flex-col items-center mb-8">
          <Logo />
          <h2 className="text-2xl font-black mt-5 text-white">Health Profile Setup</h2>
          <p className="text-white/40 text-sm mt-1 text-center">Personalise your air quality alerts</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex items-center gap-3 mb-6 p-4 bg-brandBlue/10 border border-brandBlue/20 rounded-card">
            <div className="w-9 h-9 rounded-full brand-gradient flex items-center justify-center flex-shrink-0">
              <User size={16} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Welcome, {profile?.full_name?.split(' ')[0]}!</p>
              <p className="text-xs text-white/50">Your health profile sets your personalised AQI alert threshold.</p>
            </div>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">Health Condition</label>
              <select value={form.condition_id} onChange={e => update('condition_id', e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-sm text-white outline-none focus:border-brandCyan/50 [&>option]:bg-[#060913]">
                <option value="">Select your condition</option>
                {conditions.map(c => <option key={c.condition_id} value={c.condition_id}>{c.condition_name}</option>)}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">Condition Severity</label>
              <div className="grid grid-cols-3 gap-2">
                {['Low','Medium','High'].map(s => (
                  <button key={s} type="button" onClick={() => update('severity_level', s)}
                    className={`py-2.5 rounded-btn text-sm font-semibold border transition-all
                      ${form.severity_level === s ? 'brand-gradient text-white border-transparent shadow-lg' : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">Age</label>
              <input type="number" min="1" max="120" placeholder="Your age" value={form.age}
                onChange={e => update('age', e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-3 text-sm text-white outline-none focus:border-brandCyan/50 placeholder-white/25"/>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-2">Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {['Male','Female','Other'].map(g => (
                  <button key={g} type="button" onClick={() => update('gender', g)}
                    className={`py-2.5 rounded-btn text-sm font-semibold border transition-all
                      ${form.gender === g ? 'bg-brandCyan/20 text-brandCyan border-brandCyan/40' : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white'}`}>
                    {g}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-btn px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-btn font-bold text-sm brand-gradient text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brandBlue/20 disabled:opacity-50">
              {loading ? 'Saving…' : <><span>Get Started</span><ChevronRight size={16}/></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
