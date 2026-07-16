import React, { useEffect, useRef } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Vibration } from 'react-native'
import { getAqiMeta } from '../lib/airQuality'

export default function FullScreenAlert({ visible, aqi, location, dominantPollutant, onDismiss }) {
  const pulse = useRef(new Animated.Value(1)).current

  useEffect(() => {
    if (!visible) return

    // Vibrate in pattern: buzz 500ms, pause 300ms, repeat
    Vibration.vibrate([0, 500, 300, 500, 300, 500], true)

    // Pulse animation on AQI number
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 600, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    )
    anim.start()

    return () => {
      Vibration.cancel()
      anim.stop()
      pulse.setValue(1)
    }
  }, [visible])

  const meta = getAqiMeta(aqi ?? 0)

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
    >
      <View style={[styles.container, { backgroundColor: meta.color }]}>

        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠️</Text>
        </View>

        <Text style={styles.headline}>AIR QUALITY ALERT</Text>
        <Text style={styles.location}>{location}</Text>

        <Animated.View style={{ transform: [{ scale: pulse }] }}>
          <Text style={styles.aqiNumber}>{aqi}</Text>
          <Text style={styles.aqiLabel}>AQI</Text>
        </Animated.View>

        <View style={[styles.categoryBadge, dominantPollutant ? { marginBottom: 12 } : {}]}>
          <Text style={[styles.categoryText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        {dominantPollutant ? (
          <View style={styles.pollutantBadge}>
            <Text style={styles.pollutantText}>⚠️ Primary Pollutant: {dominantPollutant}</Text>
          </View>
        ) : null}

        <Text style={styles.message}>
          Air quality has crossed your personal health threshold.{'\n'}
          Stay indoors and keep windows closed.{'\n'}
          Wear an N95 mask if you must go outside.
        </Text>

        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} activeOpacity={0.85}>
          <Text style={[styles.dismissText, { color: meta.color }]}>Dismiss Alert</Text>
        </TouchableOpacity>

        <Text style={styles.dismissNote}>You must tap dismiss to clear this alert</Text>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  iconWrap:     { marginBottom: 12 },
  icon:         { fontSize: 56 },
  headline:     { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.85)', letterSpacing: 3, marginBottom: 6, textTransform: 'uppercase' },
  location:     { fontSize: 16, color: 'rgba(255,255,255,0.9)', fontWeight: '600', marginBottom: 20 },
  aqiNumber:    { fontSize: 96, fontWeight: '900', color: '#fff', textAlign: 'center', lineHeight: 100 },
  aqiLabel:     { fontSize: 18, color: 'rgba(255,255,255,0.8)', textAlign: 'center', fontWeight: '700', marginBottom: 16 },
  categoryBadge:{ backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 24, marginBottom: 24 },
  categoryText: { fontSize: 16, fontWeight: '800' },
  pollutantBadge:{ backgroundColor: 'rgba(255,255,255,0.18)', paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  pollutantText: { fontSize: 14, fontWeight: '800', color: '#fff' },
  message:      { fontSize: 15, color: 'rgba(255,255,255,0.95)', textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  dismissBtn:   { backgroundColor: '#fff', paddingHorizontal: 48, paddingVertical: 18, borderRadius: 18, elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  dismissText:  { fontSize: 18, fontWeight: '800' },
  dismissNote:  { marginTop: 16, fontSize: 12, color: 'rgba(255,255,255,0.6)' },
})
