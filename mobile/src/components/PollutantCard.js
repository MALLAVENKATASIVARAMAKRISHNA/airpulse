import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getSeverityLabel, getSeverityColor } from '../lib/airQuality'

export default function PollutantCard({ label, value = 0, unit, limit, color, subAqi }) {
  const ratio    = Math.min(value / limit, 1)
  const sevLabel = getSeverityLabel(value, limit)
  const sevColor = getSeverityColor(value, limit)

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={[styles.dot, { backgroundColor: color }]} />
        <Text style={styles.name}>{label}</Text>
        {subAqi > 0 && (
          <View style={[styles.subBadge, { backgroundColor: color + '28' }]}>
            <Text style={[styles.subText, { color }]}>Sub-AQI {subAqi}</Text>
          </View>
        )}
      </View>

      <Text style={[styles.value, { color }]}>
        {typeof value === 'number' ? value.toFixed(1) : '—'}
        <Text style={styles.unit}> {unit}</Text>
      </Text>

      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.limitText}>Limit: {limit} {unit}</Text>
        <Text style={[styles.sevLabel, { color: sevColor }]}>{sevLabel}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card:     { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  top:      { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot:      { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  name:     { fontSize: 15, fontWeight: '700', color: '#ffffff', flex: 1 },
  subBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  subText:  { fontSize: 11, fontWeight: '600' },
  value:    { fontSize: 30, fontWeight: '800', marginBottom: 10 },
  unit:     { fontSize: 14, fontWeight: '400', color: 'rgba(255,255,255,0.45)' },
  barTrack: { height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  footer:   { flexDirection: 'row', justifyContent: 'space-between' },
  limitText:{ fontSize: 12, color: 'rgba(255,255,255,0.45)' },
  sevLabel: { fontSize: 12, fontWeight: '700' },
})
