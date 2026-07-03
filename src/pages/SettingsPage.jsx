import { useEffect, useState } from 'react'
import { Settings, Save, CheckCircle, AlertTriangle, User, ShieldAlert } from 'lucide-react'
import { api } from '../lib/api'

export default function SettingsPage({ profile, health, onReloadUser }) {
  const [nodes, setNodes] = useState([])
  const [conditions, setConditions] = useState([])
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || '',
    email: profile?.email || '',
    node_id: profile?.node_id || ''
  })

  const [healthForm, setHealthForm] = useState({
    condition_id: health?.condition_id || '',
    severity_level: health?.severity_level || 'Medium',
    age: health?.age || '',
    gender: health?.gender || 'Male'
  })

  useEffect(() => {
    Promise.all([api.nodes(), api.conditions()])
      .then(([n, c]) => {
        setNodes(n || [])
        setConditions(c || [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        email: profile.email || '',
        node_id: profile.node_id || ''
      })
    }
  }, [profile])

  useEffect(() => {
    if (health) {
      setHealthForm({
        condition_id: health.condition_id || '',
        severity_level: health.severity_level || 'Medium',
        age: health.age || '',
        gender: health.gender || 'Male'
      })
    }
  }, [health])

  function updateProfileField(k, v) {
    setProfileForm(p => ({ ...p, [k]: v }))
    setSuccess(false)
    setError('')
  }

  function updateHealthField(k, v) {
    setHealthForm(h => ({ ...h, [k]: v }))
    setSuccess(false)
    setError('')
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      // 1. Update Profile (Name, Email, Node Location)
      const profRes = await api.updateProfile(profileForm)

      // 2. Update Health Profile (Age, Severity, Condition, Gender)
      await api.saveHealth({
        ...healthForm,
        age: parseInt(healthForm.age) || 30
      })

      // 3. Store new token and update local context
      if (profRes.token) {
        api.setToken(profRes.token)
        api.setUser(profRes.user)
      }

      // 4. Reload global user data from root
      await onReloadUser()
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Failed to save changes')
    }
    setSaving(false)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Settings size={22} className="text-brandCyan" /> Account Settings
          </h1>
          <p className="text-white/40 text-sm mt-1">Manage your account profile details and chronic health conditions</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 p-4 bg-brandGreen/10 border border-brandGreen/20 rounded-btn text-brandGreen text-sm animate-fadeIn">
          <CheckCircle size={18} />
          <span className="font-semibold">Changes saved successfully! Your dashboard updates are live.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-btn text-red-400 text-sm">
          <AlertTriangle size={18} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-2">
              <User size={14} className="text-brandCyan" />
              General Profile
            </h3>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Full Name</label>
              <input
                type="text"
                value={profileForm.full_name}
                onChange={e => updateProfileField('full_name', e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2.5 text-sm text-white outline-none focus:border-brandCyan/50 placeholder-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Email Address</label>
              <input
                type="email"
                value={profileForm.email}
                onChange={e => updateProfileField('email', e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2.5 text-sm text-white outline-none focus:border-brandCyan/50 placeholder-white/20"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Monitoring Location (Node)</label>
              <select
                value={profileForm.node_id}
                onChange={e => updateProfileField('node_id', e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2.5 text-sm text-white outline-none focus:border-brandCyan/50 [&>option]:bg-[#060913]"
              >
                <option value="">Select a location</option>
                {nodes.map(n => (
                  <option key={n.node_id} value={n.node_id}>
                    {n.location} ({n.district})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Health Card */}
        <div className="glass-card p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1.5 mb-2">
              <ShieldAlert size={14} className="text-brandCyan" />
              Health & Vulnerability
            </h3>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Chronic Condition</label>
              <select
                value={healthForm.condition_id}
                onChange={e => updateHealthField('condition_id', e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2.5 text-sm text-white outline-none focus:border-brandCyan/50 [&>option]:bg-[#060913]"
              >
                <option value="">Select a condition</option>
                {conditions.map(c => (
                  <option key={c.condition_id} value={c.condition_id}>
                    {c.condition_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Severity Level</label>
              <div className="grid grid-cols-3 gap-2">
                {['Low', 'Medium', 'High'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => updateHealthField('severity_level', s)}
                    className={`py-2 rounded-btn text-xs font-semibold border transition-all ${
                      healthForm.severity_level === s
                        ? 'brand-gradient text-white border-transparent shadow'
                        : 'bg-white/5 text-white/50 border-white/10 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Age</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  value={healthForm.age}
                  onChange={e => updateHealthField('age', e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2 text-sm text-white outline-none focus:border-brandCyan/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Gender</label>
                <select
                  value={healthForm.gender}
                  onChange={e => updateHealthField('gender', e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-btn px-4 py-2 text-sm text-white outline-none focus:border-brandCyan/50 [&>option]:bg-[#060913]"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Action Button Span */}
        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-btn font-bold text-sm brand-gradient text-white hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brandBlue/20 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving changes…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}
