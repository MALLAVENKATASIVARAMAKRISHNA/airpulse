import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { useNavigation } from '@react-navigation/native'
import { useAir } from '../context/AirContext'
import { getAqiMeta, getWarnThreshold, POLLUTANTS } from '../lib/airQuality'
import { api } from '../lib/api'
import AqiGauge from '../components/AqiGauge'

const C = {
  bg:       '#0a0a0a',
  surface:  '#161616',
  surface2: '#1e1e1e',
  amber:    '#E8B84B',
  amberBg:  '#241e0a',
  purple:   '#A78BFA',
  purpleBg: '#1a1428',
  teal:     '#3DD9AC',
  tealBg:   '#0a201a',
  coral:    '#FF6B6B',
  coralBg:  '#200e0e',
  white:    '#ffffff',
  muted:    'rgba(255,255,255,0.40)',
}

const RISK_COLORS = {
  'LOW':       '#3DD9AC',
  'MODERATE':  '#E8B84B',
  'HIGH':      '#FF7043',
  'VERY HIGH': '#FF6B6B',
  'CRITICAL':  '#A78BFA',
}

const NAV_CARDS = [
  { icon: '📈', label: 'Forecast',   screen: 'Forecast',          color: C.amber,  bg: C.amberBg },
  { icon: '❤️', label: 'Health',     screen: 'HealthAssessment',  color: C.coral,  bg: C.coralBg },
  { icon: '🔔', label: 'Alerts',     screen: 'AlertCenter',       color: C.teal,   bg: C.tealBg  },
]

function formatTime(ts) {
  if (!ts) return '—'
  const t = /Z|[+-]\d{2}:\d{2}$/.test(ts) ? ts : ts + 'Z'
  return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function getTip(aqi, health) {
  const cond = health?.condition_name?.toLowerCase() ?? ''
  if (aqi <= 50)  return 'Air quality is good. Safe for all outdoor activities.'
  if (aqi <= 100) return 'Satisfactory. Unusually sensitive people should limit prolonged outdoor exertion.'
  if (aqi <= 200) {
    if (cond.includes('asthma') || cond.includes('copd'))
      return 'Moderate air quality. Keep your inhaler handy and avoid prolonged outdoor activity.'
    return 'Moderate air quality. Sensitive groups may experience minor irritation.'
  }
  if (aqi <= 300) return 'Poor air quality. Reduce outdoor activity. Wear an N95 mask if going outside.'
  return 'Severe air quality. Stay indoors, keep windows closed. Seek medical help if you feel unwell.'
}

// ── SVG Donut Pie Chart ───────────────────────────────────────────────────────
function polarXY(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutSlicePath(cx, cy, r, startDeg, endDeg) {
  if (endDeg - startDeg >= 359.9) {
    endDeg = startDeg + 359.9
  }
  const s = polarXY(cx, cy, r, startDeg)
  const e = polarXY(cx, cy, r, endDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}`
}

function DonutChart({ reading, size = 110, thickness = 18 }) {
  if (!reading) return null
  const cx = size / 2, cy = size / 2
  const r  = (size - thickness) / 2

  const sliceData = POLLUTANTS.map(p => ({
    label: p.label,
    color: p.color,
    value: reading[p.subKey] ?? 0,
  })).filter(d => d.value > 0)

  const total = sliceData.reduce((s, d) => s + d.value, 0)
  if (total === 0) return null

  let angle = 0
  const slices = sliceData.map(d => {
    const span  = (d.value / total) * 360
    const start = angle
    angle += span + 1.5 // small gap between slices
    return { ...d, start, end: angle - 1.5 }
  })

  return (
    <Svg width={size} height={size}>
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e1e1e" strokeWidth={thickness} />
      {slices.map((sl, i) => (
        <Path
          key={i}
          d={donutSlicePath(cx, cy, r, sl.start, sl.end)}
          fill="none"
          stroke={sl.color}
          strokeWidth={thickness}
          strokeLinecap="butt"
        />
      ))}
    </Svg>
  )
}

export default function HomeScreen() {
  const navigation = useNavigation()
  const { reading, allNodes, health, loading, refresh, user, predictions: mlPredictions, live, activeNodeId, setActiveNodeId } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)
  const [healthRisk, setHealthRisk] = React.useState(null)
  const [pickerVisible, setPickerVisible] = React.useState(false)

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
    <View style={s.center}><ActivityIndicator size="large" color={C.teal} /></View>
  )

  const aqi      = reading?.aqi ?? 0
  const meta     = getAqiMeta(aqi)
  const warnAt   = health ? getWarnThreshold(health.condition_name, health.severity_level, health.age) : 201
  const isDanger = aqi >= warnAt
  const firstName = user?.full_name?.split(' ')[0] ?? 'there'

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.teal} colors={[C.teal]} />}
    >
      {/* Greeting header */}
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.greeting}>Hi, {firstName} 👋</Text>
          <TouchableOpacity style={s.locationRow} onPress={() => setPickerVisible(true)}>
            <Text style={s.locationText} numberOfLines={1}>📍 {reading?.location || '—'} ▾</Text>
            {live && <View style={s.liveDot} />}
          </TouchableOpacity>
        </View>
        <View style={s.timeChip}>
          <Text style={s.timeText}>{formatTime(reading?.recorded_at)}</Text>
        </View>
      </View>

      {/* Danger banner */}
      {isDanger && (
        <View style={s.dangerBanner}>
          <Text style={s.dangerIcon}>⚠️</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.dangerTitle}>Air Quality Alert</Text>
            <Text style={s.dangerText}>AQI {aqi} — limit outdoor activity and wear a mask.</Text>
          </View>
        </View>
      )}

      {/* Gauge */}
      <View style={s.gaugeCard}>
        <Text style={s.sectionLabel}>Air Quality Index</Text>
        <AqiGauge aqi={aqi} />
      </View>

      {/* Quick nav — Forecast, Health, Alerts */}
      <View style={s.navRow}>
        {NAV_CARDS.map(card => (
          <TouchableOpacity
            key={card.screen}
            style={[s.navCard, { backgroundColor: card.bg }]}
            onPress={() => navigation.navigate(card.screen)}
            activeOpacity={0.7}
          >
            <Text style={s.navIcon}>{card.icon}</Text>
            <Text style={[s.navLabel, { color: card.color }]}>{card.label}</Text>
            <Text style={[s.navArrow, { color: card.color }]}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Forecast chips */}
      {hasPredictions && (
        <View style={s.section}>
          <View style={s.sectionRow}>
            <Text style={s.sectionTitle}>AQI Forecast</Text>
            {live && <Text style={s.liveLabel}>⚡ Live</Text>}
          </View>
          <View style={s.forecastRow}>
            {[['6h', p6, C.amber, C.amberBg], ['24h', p24, C.purple, C.purpleBg], ['48h', p48, C.teal, C.tealBg]].map(([h, val, color, bg]) => {
              const fm = getAqiMeta(val)
              return (
                <View key={h} style={[s.forecastChip, { backgroundColor: bg }]}>
                  <Text style={[s.forecastHorizon, { color }]}>{h}</Text>
                  <Text style={[s.forecastAqi, { color }]}>{val}</Text>
                  <Text style={[s.forecastLabel, { color }]}>{fm.label}</Text>
                </View>
              )
            })}
          </View>
        </View>
      )}

      {/* Sub-AQI composition — donut + legend */}
      {reading && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pollutant Composition</Text>
          <View style={[s.compositionCard, { backgroundColor: C.surface }]}>
            <DonutChart reading={reading} />
            <View style={s.compositionLegend}>
              {POLLUTANTS.map(p => {
                const sub = reading[p.subKey] ?? 0
                return (
                  <View key={p.key} style={s.legendItem}>
                    <View style={[s.legendDot, { backgroundColor: p.color }]} />
                    <Text style={s.legendPollutant}>{p.label}</Text>
                    <Text style={[s.legendValue, { color: p.color }]}>{sub}</Text>
                  </View>
                )
              })}
            </View>
          </View>
        </View>
      )}

      {/* 6 Sub-AQI mini cards */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Sub-AQI Breakdown</Text>
        <View style={s.subAqiGrid}>
          {POLLUTANTS.map(p => {
            const sub = reading?.[p.subKey] ?? 0
            const pct = Math.min((sub / 500) * 100, 100)
            return (
              <View key={p.key} style={[s.subAqiCard, { backgroundColor: p.color + '12' }]}>
                <Text style={[s.subAqiPollutant, { color: p.color }]}>{p.label}</Text>
                <Text style={[s.subAqiValue, { color: p.color }]}>{sub}</Text>
                <View style={s.subAqiBarTrack}>
                  <View style={[s.subAqiBarFill, { width: `${pct}%`, backgroundColor: p.color }]} />
                </View>
              </View>
            )
          })}
        </View>
      </View>

      {/* Dominant pollutant */}
      {reading?.dominant_pollutant && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Dominant Pollutant</Text>
          <View style={[s.infoCard, { backgroundColor: C.surface }]}>
            <View style={s.infoCardLeft}>
              <View style={[s.pollutantBadge, { backgroundColor: meta.color + '22' }]}>
                <Text style={[s.pollutantBadgeText, { color: meta.color }]}>{reading.dominant_pollutant}</Text>
              </View>
              {reading.cause && <Text style={s.causeText}>{reading.cause}</Text>}
            </View>
            <View style={[s.anomalyBadge, { backgroundColor: reading.is_anomaly ? C.coralBg : C.tealBg }]}>
              <Text style={[s.anomalyText, { color: reading.is_anomaly ? C.coral : C.teal }]}>
                {reading.is_anomaly ? '⚡ Spike' : '✓ Normal'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Health risk */}
      {healthRisk && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Your Health Risk</Text>
          <View style={[s.riskCard, { backgroundColor: C.surface }]}>
            <View style={s.riskTop}>
              <View>
                <Text style={[s.riskLevel, { color: RISK_COLORS[healthRisk.risk_level] }]}>
                  {healthRisk.risk_level}
                </Text>
                <Text style={s.riskMask}>Mask: <Text style={{ color: C.white, fontWeight: '700' }}>{healthRisk.mask}</Text></Text>
              </View>
              <View style={[s.riskScoreBox, { backgroundColor: RISK_COLORS[healthRisk.risk_level] + '20' }]}>
                <Text style={[s.riskScoreVal, { color: RISK_COLORS[healthRisk.risk_level] }]}>{healthRisk.risk_score}</Text>
                <Text style={[s.riskScoreMax, { color: RISK_COLORS[healthRisk.risk_level] }]}>/100</Text>
              </View>
            </View>
            <View style={s.riskBarTrack}>
              <View style={[s.riskBarFill, { width: `${healthRisk.risk_score}%`, backgroundColor: RISK_COLORS[healthRisk.risk_level] }]} />
            </View>
            <Text style={s.riskAdvice}>{healthRisk.advice}</Text>
          </View>
        </View>
      )}

      {/* Health tip */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Health Guidance</Text>
        <View style={[s.tipCard, { backgroundColor: C.surface, borderLeftColor: meta.color }]}>
          <Text style={s.tipText}>{getTip(aqi, health)}</Text>
        </View>
      </View>

      {/* Location Picker Modal */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <View style={s.modalBackdrop}>
          <View style={s.modalContent}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Select Location</Text>
              <TouchableOpacity onPress={() => setPickerVisible(false)}>
                <Text style={s.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={allNodes}
              keyExtractor={(item) => item.node_id}
              renderItem={({ item }) => {
                const isSelected = item.node_id === activeNodeId
                return (
                  <TouchableOpacity
                    style={[s.modalItem, isSelected && s.modalItemActive]}
                    onPress={() => {
                      setActiveNodeId(item.node_id)
                      setPickerVisible(false)
                    }}
                  >
                    <Text style={[s.modalItemText, isSelected && s.modalItemTextActive]}>
                      📍 {item.location}
                    </Text>
                    <Text style={s.modalItemDistrict}>{item.district}, {item.state}</Text>
                  </TouchableOpacity>
                )
              }}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:            { flex: 1, backgroundColor: C.bg },
  content:              { paddingBottom: 32 },
  center:               { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg },

  header:               { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  headerLeft:           { flex: 1, marginRight: 12 },
  greeting:             { fontSize: 22, fontWeight: '800', color: C.white, marginBottom: 4 },
  locationRow:          { flexDirection: 'row', alignItems: 'center', gap: 8 },
  locationText:         { fontSize: 13, color: C.muted, flex: 1 },
  liveDot:              { width: 7, height: 7, borderRadius: 4, backgroundColor: C.teal },
  timeChip:             { backgroundColor: C.surface2, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  timeText:             { fontSize: 12, color: C.muted, fontWeight: '600' },

  dangerBanner:         { flexDirection: 'row', backgroundColor: C.coralBg, marginHorizontal: 16, marginBottom: 12, borderRadius: 16, padding: 14, alignItems: 'center', gap: 10, borderLeftWidth: 3, borderLeftColor: C.coral },
  dangerIcon:           { fontSize: 20 },
  dangerTitle:          { fontSize: 14, fontWeight: '700', color: C.coral, marginBottom: 2 },
  dangerText:           { fontSize: 13, color: C.coral + 'cc', lineHeight: 18 },

  gaugeCard:            { backgroundColor: C.surface, marginHorizontal: 16, marginBottom: 16, borderRadius: 24, padding: 20, alignItems: 'center' },
  sectionLabel:         { fontSize: 11, fontWeight: '600', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },

  // Quick nav
  navRow:               { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 16 },
  navCard:              { flex: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center', gap: 4 },
  navIcon:              { fontSize: 20, marginBottom: 2 },
  navLabel:             { fontSize: 12, fontWeight: '700' },
  navArrow:             { fontSize: 12, fontWeight: '800' },

  section:              { marginHorizontal: 16, marginBottom: 16 },
  sectionRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle:         { fontSize: 13, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  liveLabel:            { fontSize: 11, fontWeight: '700', color: C.teal },

  // Forecast chips
  forecastRow:          { flexDirection: 'row', gap: 8 },
  forecastChip:         { flex: 1, borderRadius: 16, padding: 14, alignItems: 'center' },
  forecastHorizon:      { fontSize: 11, fontWeight: '700', marginBottom: 6, opacity: 0.8 },
  forecastAqi:          { fontSize: 24, fontWeight: '900', marginBottom: 2 },
  forecastLabel:        { fontSize: 10, fontWeight: '600', opacity: 0.85 },

  // Donut composition
  compositionCard:      { borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  compositionLegend:    { flex: 1, gap: 6 },
  legendItem:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot:            { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendPollutant:      { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '600', flex: 1 },
  legendValue:          { fontSize: 12, fontWeight: '800' },

  // 6 sub-AQI cards
  subAqiGrid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  subAqiCard:           { width: '31%', borderRadius: 14, padding: 12 },
  subAqiPollutant:      { fontSize: 10, fontWeight: '700', marginBottom: 4, opacity: 0.85 },
  subAqiValue:          { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  subAqiBarTrack:       { height: 3, backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 2, overflow: 'hidden' },
  subAqiBarFill:        { height: 3, borderRadius: 2 },

  // Info card
  infoCard:             { borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoCardLeft:         { flex: 1 },
  pollutantBadge:       { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, marginBottom: 8 },
  pollutantBadgeText:   { fontSize: 14, fontWeight: '800' },
  causeText:            { fontSize: 13, color: C.muted, lineHeight: 18 },
  anomalyBadge:         { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  anomalyText:          { fontSize: 12, fontWeight: '700' },

  // Risk
  riskCard:             { borderRadius: 16, padding: 16 },
  riskTop:              { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  riskLevel:            { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  riskMask:             { fontSize: 13, color: C.muted },
  riskScoreBox:         { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, gap: 2 },
  riskScoreVal:         { fontSize: 30, fontWeight: '900' },
  riskScoreMax:         { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  riskBarTrack:         { height: 5, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 12 },
  riskBarFill:          { height: 5, borderRadius: 3 },
  riskAdvice:           { fontSize: 13, color: C.muted, lineHeight: 19 },

  // Tip
  tipCard:              { borderRadius: 16, padding: 16, borderLeftWidth: 3 },
  tipText:              { fontSize: 14, color: 'rgba(255,255,255,0.70)', lineHeight: 21 },

  // Location Selector Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 320,
    maxHeight: 400,
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: C.white,
  },
  modalCloseText: {
    fontSize: 14,
    color: C.teal,
    fontWeight: '600',
  },
  modalItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  modalItemActive: {
    backgroundColor: C.tealBg,
    borderWidth: 1,
    borderColor: C.teal + '30',
  },
  modalItemText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginBottom: 2,
  },
  modalItemTextActive: {
    color: C.teal,
  },
  modalItemDistrict: {
    fontSize: 11,
    color: C.muted,
    paddingLeft: 20,
  },
})
