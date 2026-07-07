import { useCallback, useEffect, useState } from 'react'
import LoadingScreen from './components/LoadingScreen'
import AdminDashboard from './pages/AdminDashboard'
import AuthorityDashboard from './pages/AuthorityDashboard'
import AuthPage from './pages/AuthPage'
import HealthOnboarding from './pages/HealthOnboarding'
import UserDashboard from './pages/UserDashboard'
import FirstTimePasswordChange from './pages/FirstTimePasswordChange'
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

  function handleLogin(token, u, remember = true) {
    api.setToken(token, remember)
    api.setUser(u, remember)
    if (u.role === 'user') {
      setLoading(true)
    }
    setUser(u)
    loadHealth(u)
  }

  const handleReloadUser = useCallback(async () => {
    try {
      const [u, h, c] = await Promise.all([api.me(), api.getHealth(), api.conditions()])
      setUser(u)
      api.setUser(u)
      setHealth(h)
      setConditions(c)
    } catch (_) {}
  }, [])

  function signOut() {
    api.clearToken()
    api.clearUser()
    setUser(null)
    setHealth(null)
  }

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark')

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  if (loading) return <LoadingScreen />
  if (!user)   return <AuthPage onLogin={handleLogin} />

  if (user.must_change_password) {
    return (
      <FirstTimePasswordChange
        profile={user}
        onSignOut={signOut}
        onComplete={async () => {
          try {
            const u = await api.me()
            setUser(u)
            api.setUser(u)
          } catch (_) {
            signOut()
          }
        }}
      />
    )
  }

  if (user.role === 'admin')
    return <AdminDashboard profile={user} onSignOut={signOut} theme={theme} toggleTheme={toggleTheme} />

  if (user.role === 'authority')
    return <AuthorityDashboard profile={user} onSignOut={signOut} theme={theme} toggleTheme={toggleTheme} />

  if (!health)
    return <HealthOnboarding profile={user} conditions={conditions} onComplete={async () => {
      const [h, c] = await Promise.all([api.getHealth(), api.conditions()])
      setHealth(h); setConditions(c)
    }} />

  return <UserDashboard profile={user} health={health} onSignOut={signOut} onReloadUser={handleReloadUser} theme={theme} toggleTheme={toggleTheme} />
}
