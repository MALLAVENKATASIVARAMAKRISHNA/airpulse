import { useCallback, useEffect, useState } from 'react'
import LoadingScreen from './components/LoadingScreen'
import AdminDashboard from './pages/AdminDashboard'
import AuthPage from './pages/AuthPage'
import HealthOnboarding from './pages/HealthOnboarding'
import UserDashboard from './pages/UserDashboard'
import { isSupabaseConfigured, supabase } from './lib/supabase'

export default function App() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [health, setHealth] = useState(null)
  const [conditions, setConditions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadProfile = useCallback(async (user) => {
    if (!user) {
      setProfile(null)
      setHealth(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError('')
    const profileResult = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single()

    if (profileResult.error) {
      setError(`Could not load your profile: ${profileResult.error.message}`)
      setLoading(false)
      return
    }

    const currentProfile = profileResult.data
    setProfile(currentProfile)

    if (currentProfile.role === 'user') {
      const [healthResult, conditionsResult] = await Promise.all([
        supabase
          .from('user_health')
          .select('*, health_conditions(condition_name)')
          .eq('user_id', currentProfile.user_id)
          .maybeSingle(),
        supabase.from('health_conditions').select('*').order('condition_id'),
      ])
      setHealth(healthResult.data ? {
        ...healthResult.data,
        condition_name: healthResult.data.health_conditions?.condition_name,
      } : null)
      setConditions(conditionsResult.data || [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfile(data.session?.user)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      loadProfile(nextSession?.user)
    })
    return () => listener.subscription.unsubscribe()
  }, [loadProfile])

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="config-screen">
        <div>
          <h1>Connect AirPulse to Supabase</h1>
          <p>Copy <code>.env.example</code> to <code>.env</code> and add your project URL and anonymous key.</p>
        </div>
      </main>
    )
  }

  if (loading) return <LoadingScreen />
  if (error) return <main className="config-screen"><div><h1>Profile error</h1><p>{error}</p><button className="primary-button" onClick={signOut}>Sign out</button></div></main>
  if (!session) return <AuthPage />
  if (profile?.role === 'admin') return <AdminDashboard profile={profile} onSignOut={signOut} />
  if (profile && !health) {
    return <HealthOnboarding profile={profile} conditions={conditions} onComplete={() => loadProfile(session.user)} />
  }
  return <UserDashboard profile={profile} health={health} onSignOut={signOut} />
}
