import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { getAqiMeta } from '../lib/airQuality'
import { api } from '../lib/api'

export default function HotspotScreen() {
  const { allNodes, user, loading, refresh } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)
  const [clusters,   setClusters]   = React.useState([])

  React.useEffect(() => {
    api.hotspots().then(setClusters).catch(() => {})
  }, [allNodes])

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    api.hotspots().then(setClusters).catch(() => {})
    setRefreshing(false)
  }

  function clusterForNode(node_id) {
    return clusters.find(c => c.node_ids?.includes(node_id))
  }

  if (loading && !allNodes.length) return (
    <View style={s.center}><ActivityIndicator size="large" color="#3DD9AC" /></View>
  )

  const sorted = [...allNodes].sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3DD9AC" colors={['#3DD9AC']} />}
    >
      <Text style={s.pageTitle}>Pollution Hotspots</Text>
      <Text style={s.pageSub}>All monitoring stations ranked by AQI</Text>

      {sorted.map((node, i) => {
        const aqi     = node.aqi ?? 0
        const meta    = getAqiMeta(aqi)
        const isUser  = node.node_id === user.node_id
        const cluster = clusterForNode(node.node_id)

        return (
          <View key={node.node_id} style={[s.card, isUser && { borderColor: '#3DD9AC', borderWidth: 1.5 }]}>
            {/* Rank */}
            <View style={[s.rankBox, { backgroundColor: meta.color + '18' }]}>
              <Text style={[s.rankText, { color: meta.color }]}>#{i + 1}</Text>
            </View>

            {/* Info */}
            <View style={s.info}>
              <View style={s.nameRow}>
                <Text style={s.location} numberOfLines={1}>{node.location}</Text>
                {isUser && <View style={s.youBadge}><Text style={s.youText}>You</Text></View>}
                {cluster && <View style={s.clusterBadge}><Text style={s.clusterText}>{cluster.label}</Text></View>}
              </View>
              <Text style={s.district}>{node.district}</Text>
              <View style={s.barTrack}>
                <View style={[s.barFill, { width: `${Math.min((aqi / 500) * 100, 100)}%`, backgroundColor: meta.color }]} />
              </View>
              <View style={s.pollRow}>
                <PollMini label="PM2.5" value={node.pm25?.toFixed(0)} color={meta.color} />
                <PollMini label="PM10"  value={node.pm10?.toFixed(0)} color={meta.color} />
                <PollMini label="NO2"   value={node.no2?.toFixed(0)}  color={meta.color} />
              </View>
            </View>

            {/* AQI */}
            <View style={s.aqiBox}>
              <Text style={[s.aqiVal, { color: meta.color }]}>{aqi}</Text>
              <Text style={[s.aqiLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function PollMini({ label, value, color }) {
  return (
    <View style={s.pollMini}>
      <Text style={s.pollLabel}>{label} </Text>
      <Text style={[s.pollVal, { color }]}>{value ?? '—'}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0a0a0a' },
  content:     { padding: 16, paddingBottom: 40 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' },
  pageTitle:   { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  pageSub:     { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 18 },
  card:        { backgroundColor: '#161616', borderRadius: 18, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  rankBox:     { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rankText:    { fontSize: 13, fontWeight: '800' },
  info:        { flex: 1 },
  nameRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' },
  location:    { fontSize: 15, fontWeight: '700', color: '#ffffff', flexShrink: 1 },
  youBadge:    { backgroundColor: 'rgba(61,217,172,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youText:     { fontSize: 11, color: '#3DD9AC', fontWeight: '700' },
  clusterBadge:{ backgroundColor: 'rgba(167,139,250,0.18)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  clusterText: { fontSize: 11, color: '#A78BFA', fontWeight: '600' },
  district:    { fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 10 },
  barTrack:    { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 10, overflow: 'hidden' },
  barFill:     { height: 4, borderRadius: 2 },
  pollRow:     { flexDirection: 'row', gap: 14 },
  pollMini:    { flexDirection: 'row' },
  pollLabel:   { fontSize: 11, color: 'rgba(255,255,255,0.35)' },
  pollVal:     { fontSize: 11, fontWeight: '700' },
  aqiBox:      { alignItems: 'flex-end', justifyContent: 'center', minWidth: 56 },
  aqiVal:      { fontSize: 30, fontWeight: '900' },
  aqiLabel:    { fontSize: 11, fontWeight: '600', marginTop: -2 },
})
