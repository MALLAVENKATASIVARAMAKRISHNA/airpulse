import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { getSeverityLabel, getSeverityColor } from '../lib/airQuality'

export default function PollutantCard({ label, value = 0, unit, limit, color, subAqi }) {
  const ratio    = Math.min(value / limit, 1)
  const sevLabel = getSeverityLabel(value, limit)
  const sevColor = getSeverityColor(value, limit)

  return (
    <View style={s.card}>
      <View style={s.top}>
        <View style={[s.colorBar, { backgroundColor: color }]} />
        <Text style={s.name}>{label}</Text>
        {subAqi > 0 && (
          <View style={[s.subBadge, { backgroundColor: color + '22' }]}>
            <Text style={[s.subText, { color }]}>Sub-AQI {subAqi}</Text>
          </View>
        )}
      </View>

      <View style={s.valueRow}>
        <Text style={[s.value, { color }]}>
          {typeof value === 'number' ? value.toFixed(1) : '—'}
        </Text>
        <Text style={s.unit}>{unit}</Text>
      </View>

      <View style={s.barTrack}>
        <View style={[s.barFill, { width: `${ratio * 100}%`, backgroundColor: color }]} />
      </View>

      <View style={s.footer}>
        <Text style={s.limitText}>Limit {limit} {unit}</Text>
        <Text style={[s.sevLabel, { color: sevColor }]}>{sevLabel}</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  card:     { backgroundColor: '#161616', borderRadius: 18, padding: 18, marginBottom: 10 },
  top:      { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 10 },
  colorBar: { width: 4, height: 18, borderRadius: 2 },
  name:     { fontSize: 15, fontWeight: '700', color: '#ffffff', flex: 1 },
  subBadge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 8 },
  subText:  { fontSize: 11, fontWeight: '600' },
  valueRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginBottom: 14 },
  value:    { fontSize: 32, fontWeight: '800' },
  unit:     { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 4, fontWeight: '500' },
  barTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' },
  barFill:  { height: 5, borderRadius: 3 },
  footer:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  limitText:{ fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  sevLabel: { fontSize: 12, fontWeight: '700' },
})
