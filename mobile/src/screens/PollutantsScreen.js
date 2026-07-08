import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { POLLUTANTS } from '../lib/airQuality'
import PollutantCard from '../components/PollutantCard'

const EXTRA_COLORS = ['#60A5FA', '#34D399', '#FB923C']

export default function PollutantsScreen() {
  const { reading, loading, refresh } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading && !reading) return (
    <View style={s.center}><ActivityIndicator size="large" color="#3DD9AC" /></View>
  )

  const extras = [
    { label: 'CO₂',   value: reading?.co2?.toFixed(0),   unit: 'ppm',   color: EXTRA_COLORS[0] },
    { label: 'VOC',   value: reading?.voc?.toFixed(1),   unit: 'µg/m³', color: EXTRA_COLORS[1] },
    { label: 'Smoke', value: reading?.smoke?.toFixed(1), unit: 'µg/m³', color: EXTRA_COLORS[2] },
  ]

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3DD9AC" colors={['#3DD9AC']} />}
    >
      <Text style={s.pageTitle}>Pollutant Breakdown</Text>
      <Text style={s.pageSub}>📍 {reading?.location || '—'}</Text>

      {POLLUTANTS.map(p => (
        <PollutantCard
          key={p.key}
          label={p.label}
          value={reading?.[p.key] ?? 0}
          unit={p.unit}
          limit={p.limit}
          color={p.color}
          subAqi={reading?.[p.subKey] ?? 0}
        />
      ))}

      <Text style={s.subTitle}>Additional Sensors</Text>
      <View style={s.extraRow}>
        {extras.map(e => (
          <View key={e.label} style={[s.extraCard, { backgroundColor: e.color + '15' }]}>
            <Text style={[s.extraValue, { color: e.color }]}>{e.value ?? '—'}</Text>
            <Text style={[s.extraUnit, { color: e.color + '99' }]}>{e.unit}</Text>
            <Text style={s.extraLabel}>{e.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content:   { padding: 16, paddingBottom: 40 },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  pageSub:   { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 18 },
  subTitle:  { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 12 },
  extraRow:  { flexDirection: 'row', gap: 10 },
  extraCard: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  extraValue:{ fontSize: 22, fontWeight: '800', marginBottom: 2 },
  extraUnit: { fontSize: 10, fontWeight: '500', marginBottom: 6 },
  extraLabel:{ fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
})
