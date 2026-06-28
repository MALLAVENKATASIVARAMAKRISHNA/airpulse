import React, { useEffect, useState, useRef } from 'react'
import { View, ActivityIndicator, StyleSheet } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { StatusBar } from 'expo-status-bar'
import * as Notifications from 'expo-notifications'
import { Storage } from './src/lib/storage'
import { AirProvider, useAir } from './src/context/AirContext'
import AppNavigator from './src/navigation/AppNavigator'
import AuthScreen from './src/screens/AuthScreen'
import HealthSetupScreen from './src/screens/HealthSetupScreen'
import FullScreenAlert from './src/components/FullScreenAlert'
import { getAlertThreshold } from './src/lib/airQuality'
import { registerPushToken } from './src/lib/pushNotifications'
import { api } from './src/lib/api'

// Must be called before any notification can be received
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

function AlertWatcher() {
  const { reading, health } = useAir()
  const [alertVisible, setAlertVisible] = useState(false)
  const lastAlertedReadingId = useRef(null)

  useEffect(() => {
    if (!reading || !health) return
    const threshold = getAlertThreshold(health.condition_name, health.severity_level, health.age)
    const aqi       = reading.aqi ?? 0
    const readingId = reading.reading_id
    if (aqi >= threshold && readingId !== lastAlertedReadingId.current) {
      lastAlertedReadingId.current = readingId
      setAlertVisible(true)
    }
  }, [reading, health])

  return (
    <FullScreenAlert
      visible={alertVisible}
      aqi={reading?.aqi}
      location={reading?.location}
      onDismiss={() => setAlertVisible(false)}
    />
  )
}

function MainApp({ user, onLogout }) {
  return (
    <AirProvider user={user}>
      <AlertWatcher />
      <AppNavigator onLogout={onLogout} />
    </AirProvider>
  )
}

export default function App() {
  const [user, setUser]                   = useState(null)
  const [needsHealthSetup, setNeedsHealth] = useState(false)
  const [ready, setReady]                 = useState(false)
  const [notifAlert, setNotifAlert]       = useState(null)

  useEffect(() => {
    Storage.getUser().then(async u => {
      if (u) {
        const health = await api.getHealth().catch(() => null)
        if (!health) setNeedsHealth(true)
        setUser(u)
        registerPushToken()
      }
      setReady(true)
    })

    // Cold launch: app was closed, user tapped the notification
    Notifications.getLastNotificationResponseAsync().then(response => {
      if (!response) return
      const data = response.notification.request.content.data
      if (data?.aqi) setNotifAlert({ aqi: data.aqi, location: data.location })
    })

    // Background tap: app was suspended, user taps the notification
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data
      if (data?.aqi) setNotifAlert({ aqi: data.aqi, location: data.location })
    })
    return () => sub.remove()
  }, [])

  function handleLogin(user) {
    setUser(user)
    api.getHealth().catch(() => null).then(h => {
      if (!h) setNeedsHealth(true)
    })
    registerPushToken()
  }

  function handleSignup(user) {
    setUser(user)
    setNeedsHealth(true)
    registerPushToken()
  }

  function handleLogout() {
    setUser(null)
    setNeedsHealth(false)
  }

  if (!ready) return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#006aff" />
    </View>
  )

  return (
    <>
      <NavigationContainer>
        <StatusBar style="light" />
        {!user
          ? <AuthScreen onLogin={handleLogin} onSignup={handleSignup} />
          : needsHealthSetup
            ? <HealthSetupScreen onComplete={() => setNeedsHealth(false)} />
            : <MainApp user={user} onLogout={handleLogout} />
        }
      </NavigationContainer>
      <FullScreenAlert
        visible={!!notifAlert}
        aqi={notifAlert?.aqi}
        location={notifAlert?.location}
        onDismiss={() => setNotifAlert(null)}
      />
    </>
  )
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060913' },
})
