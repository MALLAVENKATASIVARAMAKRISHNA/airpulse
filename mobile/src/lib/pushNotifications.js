import * as Notifications from 'expo-notifications'
import * as Device from 'expo-device'
import { Platform } from 'react-native'
import { api } from './api'

// How notifications look when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  false,
  }),
})

export async function registerPushToken() {
  if (!Device.isDevice) {
    console.log('Push notifications only work on a real device.')
    return
  }

  // Create Android notification channel for high-priority alerts
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('aqi-alerts', {
      name:             'AQI Alerts',
      importance:       Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 500, 300, 500],
      sound:            'default',
      enableVibrate:    true,
      showBadge:        true,
    })
  }

  const { status: existing } = await Notifications.getPermissionsAsync()
  let finalStatus = existing
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied.')
    return
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '760b6e8c-943d-431e-a5bf-6bd543486624', // from app.json
    })
    const token = tokenData.data
    await api.savePushToken(token)
    console.log('Push token registered:', token)
  } catch (e) {
    console.log('Could not get push token:', e.message)
  }
}
