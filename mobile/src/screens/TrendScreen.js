import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, Dimensions, ActivityIndicator } from 'react-native'
import { LineChart } from 'react-native-chart-kit'
import { useAir } from '../context/AirContext'
import { api } from '../lib/api'
import { getAqiMeta } from '../lib/airQuality'

const W = Dimensions.get('window').width

function formatHour(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function TrendScreen() {
  const { user } = useAir()
  const [readings,   setReadings]   = useState([])
  const [refreshing, setRefreshing] = useState(false)
  const [loading,    setLoading]    = useState(true)

  const load = useCallback(async () => {
    try {
      const data = await api.nodeReadings(user.node_id)
      setReadings((data || []).reverse())
    } catch {}
    setLoading(false)
  }, [user.node_id])

  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  if (!readings.length) return (
    <View style={styles.center}>
      <Text style={styles.empty}>No readings yet. Start the simulation from the admin panel to generate data.</Text>
    </View>
  )

  const aqiValues    = readings.map(r => r.aqi ?? 0)
  const latest       = aqiValues[aqiValues.length - 1] ?? 0
  const maxAqi       = Math.max(...aqiValues)
  const minAqi       = Math.min(...aqiValues)
  const avgAqi       = Math.round(aqiValues.reduce((a, b) => a + b, 0) / aqiValues.length)
  const meta         = getAqiMeta(latest)
  const anomalyCount = readings.filter(r => r.is_anomaly).length

  const labels = readings.map((r, i) => (i % 4 === 0 ? formatHour(r.recorded_at) : ''))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      <Text style={styles.title}>AQI Trend</Text>
      <Text style={styles.sub}>Last {readings.length} readings · auto-updates every 30s</Text>

      <View style={styles.statsRow}>
        <StatBox label="Current" value={latest}  color={meta.color} />
        <StatBox label="Max"     value={maxAqi}  color="#EF5350"    />
        <StatBox label="Min"     value={minAqi}  color="#00C853"    />
        <StatBox label="Avg"     value={avgAqi}  color="#F9A825"    />
      </View>

      {anomalyCount > 0 && (
        <View style={styles.anomalyBanner}>
          <Text style={styles.anomalyIcon}>⚡</Text>
          <Text style={styles.anomalyText}>
            {anomalyCount} anomalous reading{anomalyCount > 1 ? 's' : ''} detected by AI in this window
          </Text>
        </View>
      )}

      <View style={styles.chartCard}>
        <LineChart
          data={{
            labels,
            datasets: [{ data: aqiValues, color: () => meta.color, strokeWidth: 2 }],
          }}
          width={W - 32}
          height={200}
          chartConfig={{
            backgroundGradientFrom:        '#0c1120',
            backgroundGradientTo:          '#0c1120',
            backgroundGradientFromOpacity: 1,
            backgroundGradientToOpacity:   1,
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 106, 255, ${opacity})`,
            labelColor: () => 'rgba(255,255,255,0.4)',
            propsForDots: { r: '3', strokeWidth: '1', stroke: meta.color },
            propsForBackgroundLines: { stroke: 'rgba(255,255,255,0.08)' },
          }}
          bezier
          withInnerLines
          withOuterLines={false}
          style={{ borderRadius: 12 }}
        />
      </View>

      <View style={styles.legendRow}>
        {[
          { label: 'Good ≤50',          color: '#00C853' },
          { label: 'Satisfactory ≤100', color: '#76C442' },
          { label: 'Moderate ≤200',     color: '#F9A825' },
          { label: 'Poor ≤300',         color: '#EF5350' },
        ].map(l => (
          <View key={l.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={styles.legendText}>{l.label}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

function StatBox({ label, value, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#060913' },
  content:       { padding: 16, paddingBottom: 32 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#060913' },
  empty:         { fontSize: 14, color: 'rgba(255,255,255,0.40)', textAlign: 'center', lineHeight: 20 },
  title:         { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  sub:           { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16, marginTop: 2 },
  statsRow:      { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statBox:       { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  statValue:     { fontSize: 20, fontWeight: '800' },
  statLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2, fontWeight: '600' },
  chartCard:     { backgroundColor: '#0c1120', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 12, overflow: 'hidden' },
  legendRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  legendItem:    { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:     { width: 10, height: 10, borderRadius: 5 },
  legendText:    { fontSize: 11, color: 'rgba(255,255,255,0.55)' },
  anomalyBanner: { flexDirection: 'row', backgroundColor: 'rgba(255,109,0,0.12)', borderRadius: 12, padding: 12, marginBottom: 12, alignItems: 'center', gap: 8, borderLeftWidth: 3, borderLeftColor: '#FF6D00', borderWidth: 1, borderColor: 'rgba(255,109,0,0.25)' },
  anomalyIcon:   { fontSize: 16 },
  anomalyText:   { flex: 1, fontSize: 13, color: '#FF9100', fontWeight: '600' },
})
