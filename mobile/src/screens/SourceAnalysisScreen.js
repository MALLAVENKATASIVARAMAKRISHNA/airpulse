import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { POLLUTANTS, getAqiMeta, getSeverityColor } from '../lib/airQuality'
import { api } from '../lib/api'

const CAUSE_ICONS = {
  vehicle:      { icon: '🚗', color: '#EF5350' },
  traffic:      { icon: '🚗', color: '#EF5350' },
  industrial:   { icon: '🏭', color: '#FF7043' },
  industry:     { icon: '🏭', color: '#FF7043' },
  dust:         { icon: '💨', color: '#FFCA28' },
  construction: { icon: '🏗️', color: '#FFA726' },
  burning:      { icon: '🔥', color: '#FF5722' },
  fire:         { icon: '🔥', color: '#FF5722' },
  biomass:      { icon: '🌾', color: '#8BC34A' },
  agricultural: { icon: '🌾', color: '#8BC34A' },
  weather:      { icon: '🌫️', color: '#78909C' },
  humidity:     { icon: '💧', color: '#42A5F5' },
  marine:       { icon: '🌊', color: '#26C6DA' },
  natural:      { icon: '🌿', color: '#66BB6A' },
}

const WHO_LIMITS = {
  pm25:  { label: 'PM2.5', unit: 'µg/m³', limit: 15  },
  pm10:  { label: 'PM10',  unit: 'µg/m³', limit: 45  },
  no2:   { label: 'NO2',   unit: 'µg/m³', limit: 25  },
  co:    { label: 'CO',    unit: 'mg/m³',  limit: 4   },
  ozone: { label: 'Ozone', unit: 'µg/m³', limit: 100 },
  nh3:   { label: 'NH3',   unit: 'µg/m³', limit: 400 },
}

function getCauseStyle(cause) {
  if (!cause) return { icon: '🌫️', color: '#9E9E9E' }
  const lower = cause.toLowerCase()
  for (const [kw, val] of Object.entries(CAUSE_ICONS)) {
    if (lower.includes(kw)) return val
  }
  return { icon: '🌫️', color: '#9E9E9E' }
}

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function SourceAnalysisScreen() {
  const { reading, user, loading, refresh } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)
  const [history,    setHistory]    = React.useState([])

  React.useEffect(() => {
    if (!user?.node_id) return
    api.nodeReadings(user.node_id)
      .then(rows => setHistory((rows || []).slice(0, 10)))
      .catch(() => {})
  }, [user?.node_id, reading?.reading_id])

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    if (user?.node_id) {
      api.nodeReadings(user.node_id)
        .then(rows => setHistory((rows || []).slice(0, 10)))
        .catch(() => {})
    }
    setRefreshing(false)
  }

  if (loading && !reading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  const aqi        = reading?.aqi ?? 0
  const meta       = getAqiMeta(aqi)
  const causeStyle = getCauseStyle(reading?.cause)
  const causeText  = reading?.cause || 'No cause data available yet.'

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      {/* Current cause card */}
      <View style={[styles.causeCard, { borderLeftColor: causeStyle.color }]}>
        <Text style={styles.causeEmoji}>{causeStyle.icon}</Text>
        <View style={styles.causeBody}>
          <Text style={styles.causeLabel}>Primary Pollution Source</Text>
          <Text style={styles.causeDominant}>
            {reading?.dominant_pollutant ? `${reading.dominant_pollutant} Dominant` : 'Unknown'}
          </Text>
          <Text style={styles.causeText}>{causeText}</Text>
        </View>
      </View>

      {/* Pollutant breakdown vs WHO limits */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Pollutant Levels vs WHO Limits</Text>
        <Text style={styles.sectionSub}>WHO Air Quality Guidelines (24h averages)</Text>
        {POLLUTANTS.map(p => {
          const val   = reading?.[p.key] ?? 0
          const whoL  = WHO_LIMITS[p.key]
          const limit = whoL?.limit ?? p.limit
          const pct   = Math.min((val / limit) * 100, 100)
          const bar   = getSeverityColor(val, limit)
          const over  = val > limit

          return (
            <View key={p.key} style={styles.pollRow}>
              <View style={styles.pollMeta}>
                <Text style={styles.pollLabel}>{p.label}</Text>
                <View style={styles.pollValueRow}>
                  <Text style={[styles.pollVal, { color: bar }]}>{val.toFixed(1)}</Text>
                  <Text style={styles.pollUnit}> {p.unit}</Text>
                  {over && <View style={styles.overBadge}><Text style={styles.overText}>Over limit</Text></View>}
                </View>
              </View>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: bar }]} />
                <View style={styles.barLimit} />
              </View>
              <Text style={styles.limitText}>Limit: {limit} {p.unit}</Text>
            </View>
          )
        })}
      </View>

      {/* Sub-AQI breakdown */}
      {reading && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sub-AQI Contribution</Text>
          <Text style={styles.sectionSub}>Individual pollutant AQI scores</Text>
          {[
            { key: 'sub_aqi_pm25',  label: 'PM2.5', color: '#EF5350' },
            { key: 'sub_aqi_pm10',  label: 'PM10',  color: '#FF7043' },
            { key: 'sub_aqi_co',    label: 'CO',    color: '#FFA726' },
            { key: 'sub_aqi_nh3',   label: 'NH3',   color: '#FFCA28' },
            { key: 'sub_aqi_no2',   label: 'NO2',   color: '#AB47BC' },
            { key: 'sub_aqi_ozone', label: 'Ozone', color: '#42A5F5' },
          ].map(s => {
            const val = reading[s.key] ?? 0
            const pct = Math.min((val / 500) * 100, 100)
            return (
              <View key={s.key} style={styles.subRow}>
                <Text style={styles.subLabel}>{s.label}</Text>
                <View style={styles.subTrack}>
                  <View style={[styles.subFill, { width: `${pct}%`, backgroundColor: s.color }]} />
                </View>
                <Text style={[styles.subVal, { color: s.color }]}>{val}</Text>
              </View>
            )
          })}
        </View>
      )}

      {/* Cause history */}
      {history.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Cause History</Text>
          {history.map((r, i) => {
            const cs = getCauseStyle(r.cause)
            const rm = getAqiMeta(r.aqi ?? 0)
            return (
              <View key={i} style={styles.historyRow}>
                <Text style={styles.historyIcon}>{cs.icon}</Text>
                <View style={styles.historyBody}>
                  <Text style={styles.historyTime}>{formatTime(r.recorded_at)}</Text>
                  <Text style={styles.historyCause} numberOfLines={2}>{r.cause || 'No cause recorded'}</Text>
                </View>
                <View style={[styles.historyAqi, { backgroundColor: rm.color + '28' }]}>
                  <Text style={[styles.historyAqiVal, { color: rm.color }]}>{r.aqi}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: '#0a0a0a' },
  content:      { padding: 16, paddingBottom: 32 },
  center:       { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  causeCard:    { backgroundColor: '#161616', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4, flexDirection: 'row', alignItems: 'flex-start', gap: 14,  },
  causeEmoji:   { fontSize: 36, width: 44, textAlign: 'center' },
  causeBody:    { flex: 1 },
  causeLabel:   { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  causeDominant:{ fontSize: 16, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  causeText:    { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 20 },
  section:      { backgroundColor: '#161616', borderRadius: 16, padding: 16, marginBottom: 16,  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  sectionSub:   { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 14 },
  pollRow:      { marginBottom: 14 },
  pollMeta:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pollLabel:    { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.70)' },
  pollValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pollVal:      { fontSize: 14, fontWeight: '800' },
  pollUnit:     { fontSize: 11, color: 'rgba(255,255,255,0.40)' },
  overBadge:    { backgroundColor: 'rgba(239,83,80,0.20)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  overText:     { fontSize: 10, color: '#FF5252', fontWeight: '600' },
  barTrack:     { height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden', position: 'relative', marginBottom: 2 },
  barFill:      { height: 6, borderRadius: 3 },
  barLimit:     { position: 'absolute', right: 0, width: 1.5, height: 6, backgroundColor: 'rgba(255,255,255,0.30)' },
  limitText:    { fontSize: 10, color: 'rgba(255,255,255,0.40)' },
  subRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  subLabel:     { width: 44, fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)' },
  subTrack:     { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden' },
  subFill:      { height: 6, borderRadius: 3 },
  subVal:       { width: 36, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  historyRow:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  historyIcon:  { fontSize: 22, width: 30, textAlign: 'center' },
  historyBody:  { flex: 1 },
  historyTime:  { fontSize: 11, color: 'rgba(255,255,255,0.40)', marginBottom: 2 },
  historyCause: { fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 18 },
  historyAqi:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 44 },
  historyAqiVal:{ fontSize: 15, fontWeight: '900' },
})
