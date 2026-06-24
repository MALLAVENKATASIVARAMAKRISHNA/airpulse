import { useEffect, useState } from 'react'
import { ArrowRight, Eye, EyeOff, MapPin, ShieldCheck, Wind } from 'lucide-react'
import Logo from '../components/Logo'
import { supabase } from '../lib/supabase'

export default function AuthPage() {
  const [mode, setMode] = useState('login')
  const [nodes, setNodes] = useState([])
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    nodeId: '',
    phone: '',
  })

  useEffect(() => {
    supabase.from('nodes').select('node_id, location, district').order('location')
      .then(({ data }) => {
        setNodes(data || [])
        if (data?.length) setForm((current) => ({ ...current, nodeId: data[0].node_id }))
      })
  }, [])

  function update(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
  }

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    const result = mode === 'login'
      ? await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        })
      : await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: {
              full_name: form.fullName,
              node_id: form.nodeId,
              phone_number: form.phone,
            },
          },
        })

    if (result.error) {
      setMessage(result.error.message)
    } else if (mode === 'signup' && !result.data.session) {
      setMessage('Account created. Check your email to confirm the account, then sign in.')
    }
    setLoading(false)
  }

  return (
    <main className="auth-page">
      <section className="auth-visual">
        <Logo />
        <div className="visual-copy">
          <span className="visual-icon"><Wind size={28} /></span>
          <p className="eyebrow">Breathe with confidence</p>
          <h1>Your air.<br />Understood.</h1>
          <p>Hyper-local monitoring, timely warnings, and health guidance built around the air you breathe.</p>
          <div className="auth-features">
            <span><MapPin size={17} /> Location-specific AQI</span>
            <span><ShieldCheck size={17} /> Personalized health alerts</span>
          </div>
        </div>
        <p className="copyright">© 2026 AirPulse AI Monitor</p>
      </section>

      <section className="auth-form-panel">
        <div className="mobile-logo"><Logo /></div>
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">Welcome to AirPulse</p>
          <h2>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</h2>
          <p>{mode === 'login' ? 'Monitor the air around you in real time.' : 'Set up local air monitoring in a minute.'}</p>

          <div className="auth-tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setMessage('') }}>Sign in</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setMessage('') }}>Sign up</button>
          </div>

          {mode === 'signup' && (
            <>
              <label>
                Full name
                <input name="fullName" value={form.fullName} onChange={update} placeholder="Your full name" required />
              </label>
              <label>
                Monitoring location
                <select name="nodeId" value={form.nodeId} onChange={update} required>
                  {nodes.map((node) => (
                    <option key={node.node_id} value={node.node_id}>
                      {node.location}, {node.district}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Phone number <small>Optional</small>
                <input name="phone" value={form.phone} onChange={update} placeholder="+91 98765 43210" />
              </label>
            </>
          )}

          <label>
            Email address
            <input name="email" type="email" value={form.email} onChange={update} placeholder="you@example.com" required />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                name="password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={update}
                placeholder="Minimum 6 characters"
                minLength="6"
                required
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show password">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          {message && <p className="form-message">{message}</p>}
          <button className="primary-button" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            {!loading && <ArrowRight size={18} />}
          </button>
        </form>
      </section>
    </main>
  )
}
