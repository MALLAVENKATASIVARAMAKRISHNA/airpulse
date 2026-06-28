import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { POLLUTANTS } from '../lib/airQuality'
import PollutantCard from '../components/PollutantCard'

export default function PollutantsScreen() {
  const { reading, loading, refresh } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading && !reading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      <Text style={styles.sectionTitle}>Pollutant Breakdown</Text>
      <Text style={styles.sectionSub}>{reading?.location || '—'} · Auto-updates every 30s</Text>

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

      <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Additional Sensors</Text>
      <View style={styles.extraRow}>
        <ExtraBox label="CO₂"   value={reading?.co2?.toFixed(0)}   unit="ppm"   color="#42A5F5" />
        <ExtraBox label="VOC"   value={reading?.voc?.toFixed(1)}   unit="µg/m³" color="#26C6DA" />
        <ExtraBox label="Smoke" value={reading?.smoke?.toFixed(1)} unit="µg/m³" color="#FF7043" />
      </View>
    </ScrollView>
  )
}

function ExtraBox({ label, value, unit, color }) {
  return (
    <View style={styles.extraBox}>
      <Text style={[styles.extraValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.extraUnit}>{unit}</Text>
      <Text style={styles.extraLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#060913' },
  content:      { padding: 16, paddingBottom: 32 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060913' },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  sectionSub:   { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16 },
  extraRow:     { flexDirection: 'row', gap: 10, marginTop: 12 },
  extraBox:     { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  extraValue:   { fontSize: 22, fontWeight: '800' },
  extraUnit:    { fontSize: 10, color: 'rgba(255,255,255,0.40)', marginTop: 1 },
  extraLabel:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginTop: 2 },
})
