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
  const [success, setSuccess] = useState('')
  const [debugLink, setDebugLink] = useState('')
  const [showPw, setShowPw]   = useState(false)
  const [remember, setRemember] = useState(true)
  const [resetToken, setResetToken] = useState(null)
  const [form, setForm]       = useState({ fullName: '', email: '', password: '', nodeId: '', phone: '' })

  useEffect(() => {
    // 1. Fetch nodes for signup location dropdown
    api.nodes().then(d => {
      if (d?.length) {
        setNodes(d)
        setForm(f => ({ ...f, nodeId: d[0].node_id }))
      }
    }).catch(() => {})

    // 2. Parse URL for reset_token
    const params = new URLSearchParams(window.location.search)
    const tok = params.get('reset_token')
    if (tok) {
      setResetToken(tok)
      setMode('reset')
    }
  }, [])

  function update(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess(''); setDebugLink('')
    try {
      if (mode === 'login') {
        const res = await api.login(form.email, form.password)
        onLogin(res.token, res.user, remember)
      } else if (mode === 'signup') {
        const res = await api.signup({
          full_name: form.fullName,
          email: form.email,
          password: form.password,
          node_id: form.nodeId,
          phone_number: form.phone
        })
        onLogin(res.token, res.user, true)
      } else if (mode === 'forgot') {
        const res = await api.forgotPassword(form.email)
        setSuccess(res.message)
        if (res.debug_link) {
          setDebugLink(res.debug_link)
        }
      } else if (mode === 'reset') {
        await api.resetPassword(resetToken, form.password)
        setSuccess('Password reset successful! Redirecting to sign in...')
        setTimeout(() => {
          // Clear query params and go to login
          window.history.replaceState(null, '', window.location.pathname)
          setResetToken(null)
          setSuccess('')
          setMode('login')
          update('password', '')
        }, 3000)
      }
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
          {/* Header toggles for sign-in/sign-up */}
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex bg-white/5 rounded-btn p-1 mb-6">
              {['login','signup'].map(m => (
                <button key={m} onClick={() => { setMode(m); setError(''); setSuccess('') }}
                  className={`flex-1 py-2.5 text-sm font-semibold rounded-[10px] transition-all capitalize
                    ${mode === m ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'}`}>
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {/* Reset Page headers */}
          {mode === 'forgot' && (
            <div className="mb-6">
              <h2 className="text-lg font-black text-white">Reset Password</h2>
              <p className="text-xs text-white/40 mt-1">Enter your registered email below to receive a secure reset link.</p>
            </div>
          )}

          {mode === 'reset' && (
            <div className="mb-6">
              <h2 className="text-lg font-black text-white">Choose New Password</h2>
              <p className="text-xs text-white/40 mt-1">Enter a strong, secure password for your account.</p>
            </div>
          )}

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
                <InputField label="Phone Number" icon={<Phone size={15}/>}>
                  <input type="tel" placeholder="Your phone number" value={form.phone}
                    onChange={e => update('phone', e.target.value)} required className="ap-input pl-9"/>
                </InputField>
              </>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <InputField label="Email Address" icon={<Mail size={15}/>}>
                <input type="email" placeholder="you@example.com" value={form.email}
                  onChange={e => update('email', e.target.value)} required className="ap-input pl-9"/>
              </InputField>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
              <InputField label={mode === 'reset' ? 'New Password' : 'Password'} icon={<Lock size={15}/>}>
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
            )}

            {/* Remember Me and Forgot Password bar */}
            {mode === 'login' && (
              <div className="flex items-center justify-between text-xs text-white/50 pt-1 pb-2">
                <label className="flex items-center gap-2 cursor-pointer hover:text-white transition-colors">
                  <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                    className="rounded bg-white/5 border-white/10 text-brandCyan focus:ring-0 focus:ring-offset-0 w-3.5 h-3.5"/>
                  Remember me
                </label>
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess('') }}
                  className="text-brandCyan hover:underline">
                  Forgot Password?
                </button>
              </div>
            )}

            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-btn px-3 py-2">{error}</p>}
            {success && <p className="text-brandGreen text-sm bg-brandGreen/10 border border-brandGreen/20 rounded-btn px-3 py-2">{success}</p>}

            {debugLink && (
              <div className="p-3 bg-brandBlue/10 border border-brandBlue/20 rounded-btn text-xs text-brandCyan leading-normal">
                <p className="font-bold mb-1">🔧 Testing Link (Local Debug):</p>
                <a href={debugLink} className="underline break-all">{debugLink}</a>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-btn font-bold text-sm brand-gradient text-white mt-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brandBlue/20 disabled:opacity-50">
              {loading ? 'Please wait…' : 
                mode === 'login' ? 'Sign In' : 
                mode === 'signup' ? 'Create Account' : 
                mode === 'forgot' ? 'Send Reset Link' : 'Reset Password'}
            </button>

            {/* Footer switcher for Forgot and Reset modes */}
            {(mode === 'forgot' || mode === 'reset') && (
              <button type="button" onClick={() => { setMode('login'); setError(''); setSuccess(''); setDebugLink('') }}
                className="w-full text-center text-xs text-white/40 hover:text-white transition-colors pt-2 block">
                ← Back to Sign In
              </button>
            )}
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
