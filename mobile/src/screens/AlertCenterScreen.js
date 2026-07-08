import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { getAqiMeta } from '../lib/airQuality'
import { api } from '../lib/api'

function timeAgo(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  const diff = Date.now() - new Date(t).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function fullDate(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleString([], {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export default function AlertCenterScreen() {
  const [alerts,    setAlerts]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [refreshing,setRefreshing]= useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.alertHistory()
      setAlerts(data || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (loading) return (
    <View style={s.center}><ActivityIndicator size="large" color="#3DD9AC" /></View>
  )

  const severeCount = alerts.filter(a => (a.aqi ?? 0) >= 300).length
  const highCount   = alerts.filter(a => (a.aqi ?? 0) >= 200 && (a.aqi ?? 0) < 300).length

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3DD9AC" colors={['#3DD9AC']} />}
    >
      <Text style={s.pageTitle}>Alert Center</Text>
      <Text style={s.pageSub}>History of AQI alerts for your monitoring location</Text>

      {/* Summary row */}
      {alerts.length > 0 && (
        <View style={s.summaryRow}>
          <View style={s.summaryCard}>
            <Text style={s.summaryValue}>{alerts.length}</Text>
            <Text style={s.summaryLabel}>Total</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#241e0a' }]}>
            <Text style={[s.summaryValue, { color: '#E8B84B' }]}>{highCount}</Text>
            <Text style={s.summaryLabel}>Poor</Text>
          </View>
          <View style={[s.summaryCard, { backgroundColor: '#200e0e' }]}>
            <Text style={[s.summaryValue, { color: '#FF6B6B' }]}>{severeCount}</Text>
            <Text style={s.summaryLabel}>Severe</Text>
          </View>
        </View>
      )}

      {/* Alert list */}
      {alerts.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>No alerts yet</Text>
          <Text style={s.emptyText}>
            You'll see alerts here when AQI at your location exceeds your personal safety threshold.
          </Text>
        </View>
      ) : (
        alerts.map((alert, i) => {
          const aqi  = alert.aqi ?? 0
          const meta = getAqiMeta(aqi)
          return (
            <View key={alert.log_id ?? i} style={s.alertCard}>
              {/* Left color strip */}
              <View style={[s.alertStrip, { backgroundColor: meta.color }]} />

              {/* Main content */}
              <View style={s.alertBody}>
                <View style={s.alertTop}>
                  <View style={[s.aqiBadge, { backgroundColor: meta.color + '20' }]}>
                    <Text style={[s.aqiBadgeText, { color: meta.color }]}>AQI {aqi}</Text>
                  </View>
                  <Text style={[s.aqiLabel, { color: meta.color }]}>{meta.label}</Text>
                  <Text style={s.timeAgo}>{timeAgo(alert.alerted_at)}</Text>
                </View>

                <Text style={s.location}>📍 {alert.location || alert.node_id || '—'}</Text>
                <Text style={s.fullDate}>{fullDate(alert.alerted_at)}</Text>
              </View>

              {/* AQI value */}
              <Text style={[s.aqiRight, { color: meta.color }]}>{aqi}</Text>
            </View>
          )
        })
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0a' },
  content:        { padding: 16, paddingBottom: 40 },
  center:         { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  pageTitle:      { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  pageSub:        { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16 },

  summaryRow:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summaryCard:    { flex: 1, backgroundColor: '#161616', borderRadius: 14, padding: 14, alignItems: 'center' },
  summaryValue:   { fontSize: 24, fontWeight: '900', color: '#ffffff', marginBottom: 2 },
  summaryLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: '600' },

  emptyCard:      { backgroundColor: '#161616', borderRadius: 20, padding: 32, alignItems: 'center', marginTop: 20 },
  emptyIcon:      { fontSize: 40, marginBottom: 12 },
  emptyTitle:     { fontSize: 18, fontWeight: '700', color: '#ffffff', marginBottom: 8 },
  emptyText:      { fontSize: 13, color: 'rgba(255,255,255,0.40)', textAlign: 'center', lineHeight: 19 },

  alertCard:      { backgroundColor: '#161616', borderRadius: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden' },
  alertStrip:     { width: 4 },
  alertBody:      { flex: 1, padding: 14 },
  alertTop:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  aqiBadge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  aqiBadgeText:   { fontSize: 12, fontWeight: '700' },
  aqiLabel:       { fontSize: 12, fontWeight: '600', flex: 1 },
  timeAgo:        { fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: '600' },
  location:       { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 3, fontWeight: '500' },
  fullDate:       { fontSize: 11, color: 'rgba(255,255,255,0.30)' },
  aqiRight:       { fontSize: 28, fontWeight: '900', alignSelf: 'center', paddingRight: 16 },
})
