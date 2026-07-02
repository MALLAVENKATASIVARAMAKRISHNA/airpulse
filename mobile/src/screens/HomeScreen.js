import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { getAqiMeta, getWarnThreshold } from '../lib/airQuality'
import { api } from '../lib/api'
import AqiGauge from '../components/AqiGauge'

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function HomeScreen() {
  const { reading, health, loading, refresh, user, predictions: mlPredictions, live } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)
  const [healthRisk, setHealthRisk] = React.useState(null)

  // predictions come from IoT ML topic via AirContext
  const p6  = mlPredictions?.['6h']  ?? reading?.aqi ?? 0
  const p24 = mlPredictions?.['24h'] ?? reading?.aqi ?? 0
  const p48 = mlPredictions?.['48h'] ?? reading?.aqi ?? 0
  const hasPredictions = !!mlPredictions?.['6h']

  React.useEffect(() => {
    if (!reading?.aqi) return
    api.healthRisk({ current_aqi: reading.aqi, future6: p6, future24: p24, future48: p48 })
      .then(setHealthRisk).catch(() => {})
  }, [reading?.aqi, p6, p24, p48])

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading && !reading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  const aqi      = reading?.aqi ?? 0
  const meta     = getAqiMeta(aqi)
  const warnAt   = health ? getWarnThreshold(health.condition_name, health.severity_level, health.age) : 201
  const isDanger = aqi >= warnAt

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      {/* Location + time */}
      <View style={styles.locationBar}>
        <Text style={styles.locationIcon}>📍</Text>
        <Text style={styles.locationText}>{reading?.location || '—'}</Text>
        <Text style={styles.updateTime}>Updated {formatTime(reading?.recorded_at)}</Text>
      </View>

      {/* Danger banner */}
      {isDanger && (
        <View style={styles.dangerBanner}>
          <Text style={styles.dangerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.dangerTitle}>Poor Air Quality Alert</Text>
            <Text style={styles.dangerText}>AQI is {aqi} — limit outdoor activities and wear a mask.</Text>
          </View>
        </View>
      )}

      {/* Gauge */}
      <View style={styles.gaugeCard}>
        <AqiGauge aqi={aqi} />
      </View>

      {/* AQI Forecast */}
      {hasPredictions && (
        <View style={styles.forecastCard}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <Text style={styles.forecastTitle}>AQI Forecast</Text>
            {live && <Text style={{ fontSize: 10, color: '#10d343', fontWeight: '700' }}>⚡ Live</Text>}
          </View>
          <View style={styles.forecastRow}>
            {[['6h', p6], ['24h', p24], ['48h', p48]].map(([h, val]) => {
              const fMeta = getAqiMeta(val)
              return (
                <View key={h} style={[styles.forecastChip, { borderColor: fMeta.color }]}>
                  <Text style={styles.forecastHorizon}>{h}</Text>
                  <Text style={[styles.forecastAqi, { color: fMeta.color }]}>{val}</Text>
                  <Text style={[styles.forecastLabel, { color: fMeta.color }]}>{fMeta.label}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Dominant pollutant */}
      {reading?.dominant_pollutant && (
        <View style={[styles.infoCard, { borderLeftColor: meta.color }]}>
          <Text style={styles.infoLabel}>Dominant Pollutant</Text>
          <Text style={[styles.infoValue, { color: meta.color }]}>{reading.dominant_pollutant}</Text>
          {reading.cause && <Text style={styles.infoDesc}>{reading.cause}</Text>}
        </View>
      )}

      {/* Quick stats */}
      <View style={styles.statsRow}>
        <StatBox label="PM2.5" value={reading?.pm25?.toFixed(1)} unit="µg/m³" color="#EF5350" />
        <StatBox label="PM10"  value={reading?.pm10?.toFixed(1)} unit="µg/m³" color="#FF7043" />
        <StatBox label="NO2"   value={reading?.no2?.toFixed(1)}  unit="µg/m³" color="#AB47BC" />
      </View>

      {/* Health Risk Card */}
      {healthRisk && (
        <View style={[styles.riskCard, { borderLeftColor: RISK_COLORS[healthRisk.risk_level] }]}>
          <View style={styles.riskTop}>
            <View>
              <Text style={styles.riskLabel}>Your Health Risk</Text>
              <Text style={[styles.riskLevel, { color: RISK_COLORS[healthRisk.risk_level] }]}>
                {healthRisk.risk_level}
              </Text>
            </View>
            <View style={[styles.riskScore, { backgroundColor: RISK_COLORS[healthRisk.risk_level] + '28' }]}>
              <Text style={[styles.riskScoreVal, { color: RISK_COLORS[healthRisk.risk_level] }]}>
                {healthRisk.risk_score}
              </Text>
              <Text style={[styles.riskScoreMax, { color: RISK_COLORS[healthRisk.risk_level] }]}>/100</Text>
            </View>
          </View>
          <View style={styles.riskBarTrack}>
            <View style={[styles.riskBarFill, { width: `${healthRisk.risk_score}%`, backgroundColor: RISK_COLORS[healthRisk.risk_level] }]} />
          </View>
          <Text style={styles.riskMask}>😷 Mask: <Text style={{ fontWeight: '700', color: '#fff' }}>{healthRisk.mask}</Text></Text>
          <Text style={styles.riskAdvice}>{healthRisk.advice}</Text>
        </View>
      )}

      {/* Health tip */}
      <View style={[styles.tipCard, { borderLeftColor: meta.color }]}>
        <Text style={[styles.tipTitle, { color: meta.color }]}>Health Guidance</Text>
        <Text style={styles.tipText}>{getTip(aqi, health)}</Text>
      </View>
    </ScrollView>
  )
}

const RISK_COLORS = {
  'LOW':       '#00C853',
  'MODERATE':  '#F9A825',
  'HIGH':      '#FF7043',
  'VERY HIGH': '#EF5350',
  'CRITICAL':  '#AB47BC',
}

function StatBox({ label, value, unit, color }) {
  return (
    <View style={styles.statBox}>
      <Text style={[styles.statValue, { color }]}>{value ?? '—'}</Text>
      <Text style={styles.statUnit}>{unit}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  )
}

function getTip(aqi, health) {
  const condition = health?.condition_name?.toLowerCase() ?? ''
  if (aqi <= 50)  return 'Air quality is good. Safe for all activities outdoors.'
  if (aqi <= 100) return 'Air quality is satisfactory. Unusually sensitive people should reduce prolonged outdoor exertion.'
  if (aqi <= 200) {
    if (condition.includes('asthma') || condition.includes('copd'))
      return 'Moderate air quality. Keep your inhaler handy and avoid prolonged outdoor activity.'
    return 'Moderate air quality. Sensitive groups may experience minor irritation.'
  }
  if (aqi <= 300) return 'Poor air quality. Everyone should reduce outdoor activity. Wear an N95 mask if going outside.'
  return 'Very poor to severe air quality. Stay indoors, keep windows closed. Seek medical help if you feel unwell.'
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#060913' },
  content:       { paddingBottom: 24 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060913' },
  locationBar:   { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  locationIcon:  { fontSize: 14, marginRight: 6 },
  locationText:  { flex: 1, fontSize: 14, fontWeight: '600', color: '#ffffff' },
  updateTime:    { fontSize: 12, color: 'rgba(255,255,255,0.4)' },
  dangerBanner:  { flexDirection: 'row', backgroundColor: 'rgba(239,83,80,0.12)', borderLeftWidth: 4, borderLeftColor: '#EF5350', marginHorizontal: 16, marginTop: 12, borderRadius: 12, padding: 14, alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: 'rgba(239,83,80,0.25)' },
  dangerIcon:    { fontSize: 20 },
  dangerTitle:   { fontSize: 14, fontWeight: '700', color: '#FF5252', marginBottom: 2 },
  dangerText:    { fontSize: 13, color: 'rgba(255,82,82,0.8)', lineHeight: 18 },
  gaugeCard:     { backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16, marginTop: 12, borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  infoCard:      { backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  infoLabel:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  infoValue:     { fontSize: 18, fontWeight: '800', marginBottom: 4 },
  infoDesc:      { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  statsRow:      { flexDirection: 'row', marginHorizontal: 16, marginTop: 12, gap: 8 },
  statBox:       { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  statValue:     { fontSize: 20, fontWeight: '800' },
  statUnit:      { fontSize: 10, color: 'rgba(255,255,255,0.4)', marginTop: 1 },
  statLabel:     { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  riskCard:      { backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  riskTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  riskLabel:     { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  riskLevel:     { fontSize: 18, fontWeight: '800' },
  riskScore:     { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  riskScoreVal:  { fontSize: 26, fontWeight: '900' },
  riskScoreMax:  { fontSize: 13, fontWeight: '600', marginBottom: 3 },
  riskBarTrack:  { height: 6, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 3, overflow: 'hidden', marginBottom: 10 },
  riskBarFill:   { height: 6, borderRadius: 3 },
  riskMask:      { fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 4 },
  riskAdvice:    { fontSize: 13, color: 'rgba(255,255,255,0.70)', lineHeight: 18 },
  tipCard:       { marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', borderLeftWidth: 4 },
  tipTitle:      { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  tipText:       { fontSize: 14, lineHeight: 20, color: 'rgba(255,255,255,0.75)' },
  forecastCard:  { backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16, marginTop: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  forecastTitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  forecastRow:   { flexDirection: 'row', gap: 8 },
  forecastChip:  { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)', padding: 10, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  forecastHorizon:{ fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.45)', marginBottom: 4 },
  forecastAqi:   { fontSize: 22, fontWeight: '900', color: '#ffffff' },
  forecastLabel: { fontSize: 10, fontWeight: '600', marginTop: 1 },
})
