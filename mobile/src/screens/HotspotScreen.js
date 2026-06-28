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
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  const sorted = [...allNodes].sort((a, b) => (b.aqi ?? 0) - (a.aqi ?? 0))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      <Text style={styles.title}>Pollution Hotspots</Text>
      <Text style={styles.sub}>All monitoring stations ranked by AQI · auto-updates every 30s</Text>

      {sorted.map((node, i) => {
        const aqi     = node.aqi ?? 0
        const meta    = getAqiMeta(aqi)
        const isUser  = node.node_id === user.node_id
        const cluster = clusterForNode(node.node_id)

        return (
          <View key={node.node_id} style={[styles.card, isUser && styles.cardHighlight]}>
            <View style={[styles.rank, { backgroundColor: meta.color + '28' }]}>
              <Text style={[styles.rankText, { color: meta.color }]}>#{i + 1}</Text>
            </View>

            <View style={styles.info}>
              <View style={styles.nameRow}>
                <Text style={styles.location}>{node.location}</Text>
                {isUser && <View style={styles.youBadge}><Text style={styles.youText}>Your location</Text></View>}
                {cluster && <View style={styles.clusterBadge}><Text style={styles.clusterText}>{cluster.label}</Text></View>}
              </View>
              <Text style={styles.district}>{node.district}, {node.state}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${Math.min((aqi / 500) * 100, 100)}%`, backgroundColor: meta.color }]} />
              </View>
              <View style={styles.pollRow}>
                <PollMini label="PM2.5" value={node.pm25?.toFixed(0)} />
                <PollMini label="PM10"  value={node.pm10?.toFixed(0)} />
                <PollMini label="NO2"   value={node.no2?.toFixed(0)}  />
              </View>
            </View>

            <View style={styles.aqiBox}>
              <Text style={[styles.aqiValue, { color: meta.color }]}>{aqi}</Text>
              <Text style={[styles.aqiLabel, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
        )
      })}
    </ScrollView>
  )
}

function PollMini({ label, value }) {
  return (
    <View style={styles.pollMini}>
      <Text style={styles.pollLabel}>{label} </Text>
      <Text style={styles.pollValue}>{value ?? '—'}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#060913' },
  content:       { padding: 16, paddingBottom: 32 },
  center:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060913' },
  title:         { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  sub:           { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16, marginTop: 2 },
  card:          { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  cardHighlight: { borderColor: '#006aff', borderWidth: 2 },
  rank:          { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rankText:      { fontSize: 13, fontWeight: '700' },
  info:          { flex: 1 },
  nameRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  location:      { fontSize: 15, fontWeight: '700', color: '#ffffff', flexShrink: 1 },
  youBadge:      { backgroundColor: 'rgba(0,106,255,0.20)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  youText:       { fontSize: 11, color: '#006aff', fontWeight: '600' },
  clusterBadge:  { backgroundColor: 'rgba(171,71,188,0.20)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  clusterText:   { fontSize: 11, color: '#AB47BC', fontWeight: '600' },
  district:      { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 8 },
  barTrack:      { height: 4, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' },
  barFill:       { height: 4, borderRadius: 2 },
  pollRow:       { flexDirection: 'row', gap: 12 },
  pollMini:      { flexDirection: 'row' },
  pollLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.40)' },
  pollValue:     { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.65)' },
  aqiBox:        { alignItems: 'flex-end', justifyContent: 'center' },
  aqiValue:      { fontSize: 28, fontWeight: '900' },
  aqiLabel:      { fontSize: 11, fontWeight: '600', marginTop: -2 },
})
