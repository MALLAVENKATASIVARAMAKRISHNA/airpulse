import { useCallback, useEffect, useState } from 'react'
import LoadingScreen from './components/LoadingScreen'
import AdminDashboard from './pages/AdminDashboard'
import AuthorityDashboard from './pages/AuthorityDashboard'
import AuthPage from './pages/AuthPage'
import HealthOnboarding from './pages/HealthOnboarding'
import UserDashboard from './pages/UserDashboard'
import { api } from './lib/api'

export default function App() {
  const [user,       setUser]       = useState(api.getUser)
  const [health,     setHealth]     = useState(null)
  const [conditions, setConditions] = useState([])
  const [loading,    setLoading]    = useState(!!api.getUser())

  const loadHealth = useCallback(async (u) => {
    if (!u || u.role !== 'user') { setLoading(false); return }
    try {
      const [h, c] = await Promise.all([api.getHealth(), api.conditions()])
      setHealth(h)
      setConditions(c)
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => {
    const stored = api.getUser()
    if (!stored) { setLoading(false); return }
    api.me()
      .then(u => { setUser(u); api.setUser(u); loadHealth(u) })
      .catch(() => { api.clearToken(); api.clearUser(); setUser(null); setLoading(false) })
  }, [loadHealth])

  function handleLogin(token, u) {
    api.setToken(token)
    api.setUser(u)
    if (u.role === 'user') {
      setLoading(true)
    }
    setUser(u)
    loadHealth(u)
  }

  function signOut() {
    api.clearToken()
    api.clearUser()
    setUser(null)
    setHealth(null)
  }

  if (loading) return <LoadingScreen />
  if (!user)   return <AuthPage onLogin={handleLogin} />

  if (user.role === 'admin')
    return <AdminDashboard profile={user} onSignOut={signOut} />

  if (user.role === 'authority')
    return <AuthorityDashboard profile={user} onSignOut={signOut} />

  if (!health)
    return <HealthOnboarding profile={user} conditions={conditions} onComplete={async () => {
      const [h, c] = await Promise.all([api.getHealth(), api.conditions()])
      setHealth(h); setConditions(c)
    }} />

  return <UserDashboard profile={user} health={health} onSignOut={signOut} />
}
