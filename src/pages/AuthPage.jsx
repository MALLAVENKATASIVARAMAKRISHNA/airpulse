import { useState, useEffect } from 'react'
import { Eye, EyeOff, Lock, Mail, User, Phone, MapPin } from 'lucide-react'
import { api } from '../lib/api'
import Logo from '../components/Logo'

function friendlyError(msg) {
  const m = (msg || '').toLowerCase()
  if (m.includes('already exists'))    return 'An account with this email already exists.'
  if (m.includes('incorrect email'))   return 'Incorrect email or password.'
  if (m.includes('not authenticated')) return 'Session expired. Please sign in again.'
  if (m.includes('invalid monitoring'))return 'Please select a monitoring location.'
  return msg
}

export default function AuthPage({ onLogin }) {
  const [mode, setMode]       = useState('login')
  const [nodes, setNodes]     = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [form, setForm]       = useState({ fullName: '', email: '', password: '', nodeId: '', phone: '' })

  useEffect(() => {
    api.nodes().then(d => {
      if (d?.length) {
        setNodes(d)
        setForm(f => ({ ...f, nodeId: d[0].node_id }))
      }
    }).catch(() => {})
  }, [])

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = mode === 'login'
        ? await api.login(form.email, form.password)
        : await api.signup({ full_name: form.fullName, email: form.email, password: form.password, node_id: form.nodeId, phone_number: form.phone })
      api.setToken(res.token)
      api.setUser(res.user)
      onLogin(res.token, res.user)
    } catch (err) {
      setError(friendlyError(err.message))
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-darkBg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="mesh-glow-blue" />
      <div className="mesh-glow-green" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 mb-4">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_20px_rgba(0,106,255,0.5)]">
              <defs>
                <linearGradient id="auth-logo" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#006aff" />
                  <stop offset="100%" stopColor="#10d343" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="48" fill="url(#auth-logo)" />
              <path d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
                stroke="white" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
          </div>
          <h1 className="text-3xl font-black tracking-tight">
            <span className="text-white">air</span>
            <span className="brand-text">pulse</span>
          </h1>
          <p className="text-xs text-white/40 tracking-widest uppercase mt-1">Breathe Informed. Live Safer.</p>
        </div>

        <div className="glass-card p-8">
          <div className="flex bg-white/5 rounded-btn p-1 mb-6">
            {['login','signup'].map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }}
                className={`flex-1 py-2.5 text-sm font-semibold rounded-[10px] transition-all capitalize
                  ${mode === m ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <InputField label="Full Name" icon={<User size={15}/>}>
                  <input type="text" placeholder="Your full name" value={form.fullName}
                    onChange={e => update('fullName', e.target.value)} required className="ap-input pl-9"/>
                </InputField>
                <InputField label="Monitoring Location" icon={<MapPin size={15}/>}>
                  <select value={form.nodeId} onChange={e => update('nodeId', e.target.value)} className="ap-input pl-9" required>
                    {nodes.map(n => <option key={n.node_id} value={n.node_id}>{n.location}, {n.district}</option>)}
                  </select>
                </InputField>
                <InputField label="Phone (Optional)" icon={<Phone size={15}/>}>
                  <input type="tel" placeholder="Your phone number" value={form.phone}
                    onChange={e => update('phone', e.target.value)} className="ap-input pl-9"/>
                </InputField>
              </>
            )}
            <InputField label="Email Address" icon={<Mail size={15}/>}>
              <input type="email" placeholder="you@example.com" value={form.email}
                onChange={e => update('email', e.target.value)} required className="ap-input pl-9"/>
            </InputField>
            <InputField label="Password" icon={<Lock size={15}/>}>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} placeholder="Minimum 6 characters"
                  value={form.password} onChange={e => update('password', e.target.value)}
                  required className="ap-input pl-9 pr-10"/>
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showPw ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </InputField>

            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-btn px-3 py-2">{error}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-btn font-bold text-sm brand-gradient text-white mt-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brandBlue/20 disabled:opacity-50">
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .ap-input { width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:12px; padding:11px 14px; font-size:14px; color:white; outline:none; transition:border-color 0.2s; }
        .ap-input:focus { border-color:rgba(0,162,255,0.5); }
        .ap-input option { background:#060913; color:white; }
        .ap-input::placeholder { color:rgba(255,255,255,0.25); }
      `}</style>
    </div>
  )
}

function InputField({ label, icon, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 z-10">{icon}</span>
        {children}
      </div>
    </div>
  )
}
