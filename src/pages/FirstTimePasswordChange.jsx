import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { api } from '../lib/api'

export default function FirstTimePasswordChange({ profile, onComplete, onSignOut }) {
  const [currentPw, setCurrentPw] = useState('authority@123')
  const [newPw, setNewPw]         = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    if (newPw.length < 6) {
      return setError('New password must be at least 6 characters long.')
    }
    if (newPw !== confirmPw) {
      return setError('Passwords do not match.')
    }
    if (newPw === 'authority@123') {
      return setError('Please choose a password different from the default password.')
    }

    setLoading(true); setError(''); setSuccess('')
    try {
      await api.changePassword(currentPw, newPw)
      setSuccess('Password updated successfully! Redirecting to dashboard...')
      setTimeout(() => {
        onComplete()
      }, 2000)
    } catch (err) {
      setError(err.message || 'Failed to update password.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-darkBg flex items-center justify-center p-4 relative overflow-hidden">
      <div className="mesh-glow-blue" />
      <div className="mesh-glow-green" />

      <div className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-black tracking-tight text-white">
            Security <span className="brand-text">Setup</span>
          </h1>
          <p className="text-xs text-white/40 tracking-wider uppercase mt-1">First-Time Password Change Required</p>
        </div>

        <div className="glass-card p-8">
          <div className="mb-6">
            <h2 className="text-sm font-bold text-white/80">Welcome, {profile.full_name}!</h2>
            <p className="text-xs text-white/40 mt-1">
              Your administrator created this account with a default password. For your security, you must update your password before accessing the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Current Default Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 z-10"><Lock size={15}/></span>
                <input type={showCurrent ? 'text' : 'password'} value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                  required className="ap-input pl-9 pr-10"/>
                <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showCurrent ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">New Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 z-10"><Lock size={15}/></span>
                <input type={showNew ? 'text' : 'password'} placeholder="At least 6 characters" value={newPw} onChange={e => setNewPw(e.target.value)}
                  required className="ap-input pl-9 pr-10"/>
                <button type="button" onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showNew ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div>
              <label className="text-xs font-semibold text-white/50 uppercase tracking-wide block mb-1.5">Confirm New Password</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 z-10"><Lock size={15}/></span>
                <input type={showConfirm ? 'text' : 'password'} placeholder="Re-enter password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                  required className="ap-input pl-9 pr-10"/>
                <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                  {showConfirm ? <EyeOff size={15}/> : <Eye size={15}/>}
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-btn px-3 py-2">{error}</p>}
            {success && <p className="text-brandGreen text-sm bg-brandGreen/10 border border-brandGreen/20 rounded-btn px-3 py-2">{success}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-btn font-bold text-sm brand-gradient text-white mt-2 hover:opacity-90 active:scale-[0.98] transition-all shadow-lg shadow-brandBlue/20 disabled:opacity-50">
              {loading ? 'Updating...' : 'Save & Continue'}
            </button>

            <button type="button" onClick={onSignOut}
              className="w-full text-center text-xs text-white/40 hover:text-white transition-colors pt-2 block">
              Cancel & Sign Out
            </button>
          </form>
        </div>
      </div>

      <style>{`
        .ap-input { width:100%; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);
          border-radius:12px; padding:11px 14px; padding-left: 36px; font-size:14px; color:white; outline:none; transition:border-color 0.2s; }
        .ap-input:focus { border-color:rgba(0,162,255,0.5); }
      `}</style>
    </div>
  )
}
