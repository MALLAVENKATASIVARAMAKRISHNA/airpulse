import React from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { getAqiMeta } from '../lib/airQuality'

const CONDITION_TIPS = {
  asthma: {
    icon: '🫁',
    label: 'Asthma',
    tips: [
      'Always carry your rescue inhaler when going outdoors.',
      'Use a peak flow meter daily to monitor airway function.',
      'Avoid areas with heavy traffic, construction dust, or smoke.',
      'Keep windows closed on high-AQI days; use an air purifier indoors.',
      'Rinse nasal passages with saline after outdoor exposure.',
    ],
  },
  copd: {
    icon: '🌬️',
    label: 'COPD',
    tips: [
      'Avoid outdoor activity during morning hours when pollutant levels peak.',
      'Keep bronchodilators accessible at all times.',
      'Use an N95 mask if you must go outside on poor air days.',
      'Monitor oxygen saturation with a pulse oximeter.',
      'Stay hydrated to keep mucus thin and easier to clear.',
    ],
  },
  heart: {
    icon: '❤️',
    label: 'Heart Condition',
    tips: [
      'Avoid strenuous outdoor exercise when AQI exceeds 100.',
      'Fine particles (PM2.5) directly stress the cardiovascular system — watch PM2.5 levels.',
      'Take prescribed medications regularly; do not skip doses.',
      'Monitor blood pressure daily, especially on high-AQI days.',
      'Report any unusual shortness of breath or chest pain immediately.',
    ],
  },
  diabetes: {
    icon: '🩺',
    label: 'Diabetes',
    tips: [
      'Air pollution can raise blood glucose — monitor more frequently on bad air days.',
      'Avoid prolonged outdoor activity when AQI is above 150.',
      'Keep blood sugar management medications with you at all times.',
      'Stay hydrated; dehydration compounds the inflammatory response.',
      'Wear a mask to reduce particulate inhalation during outdoor errands.',
    ],
  },
  children: {
    icon: '👶',
    label: 'Children',
    tips: [
      'Keep children indoors and windows closed when AQI is above 100.',
      'Schedule outdoor play in the early morning when air is relatively cleaner.',
      'Ensure children wear masks sized for their face on moderate+ AQI days.',
      'Avoid playgrounds near busy roads or industrial areas.',
      'Watch for coughing fits, eye irritation, or wheezing as early warning signs.',
    ],
  },
  elderly: {
    icon: '🧓',
    label: 'Elderly',
    tips: [
      'Limit outdoor time to short essential trips when AQI is above 100.',
      'Keep indoor air clean with a HEPA air purifier.',
      'Stay hydrated and maintain indoor humidity between 40–60%.',
      'Ask a caregiver to check on you daily during high-pollution events.',
      'Take any prescribed respiratory or heart medications as scheduled.',
    ],
  },
}

const DEFAULT_TIPS = {
  icon: '🧍',
  label: 'General',
  tips: [
    'Stay indoors during peak pollution hours (morning rush and evening).',
    'Wear an N95 mask if outdoor activity is unavoidable.',
    'Run air purifiers with HEPA filters in living and bedroom areas.',
    'Keep windows closed and use exhaust fans only when AQI is low.',
    'Drink plenty of water — hydration helps the body clear inhaled particles.',
  ],
}

const AQI_ADVICE = [
  { max: 50,  color: '#00C853', label: 'Good',         message: 'Air quality is excellent. Enjoy outdoor activities freely.' },
  { max: 100, color: '#76C442', label: 'Satisfactory', message: 'Air is acceptable. Very sensitive individuals should limit prolonged exertion.' },
  { max: 200, color: '#F9A825', label: 'Moderate',     message: 'Moderate risk. Sensitive groups should reduce extended outdoor activity.' },
  { max: 300, color: '#EF5350', label: 'Poor',         message: 'Poor air quality. Everyone should reduce outdoor time. Wear a mask.' },
  { max: 400, color: '#AB47BC', label: 'Very Poor',    message: 'Very poor. Avoid all non-essential outdoor exposure. Keep windows shut.' },
  { max: 999, color: '#7B1FA2', label: 'Severe',       message: 'Hazardous conditions. Stay indoors, seal gaps in doors/windows, seek medical help if symptomatic.' },
]

function getAqiAdvice(aqi) {
  return AQI_ADVICE.find(a => aqi <= a.max) ?? AQI_ADVICE[AQI_ADVICE.length - 1]
}

function getConditionTips(conditionName) {
  if (!conditionName) return DEFAULT_TIPS
  const c = conditionName.toLowerCase()
  for (const [key, val] of Object.entries(CONDITION_TIPS)) {
    if (c.includes(key)) return val
  }
  return DEFAULT_TIPS
}

function getHighlight(aqi, band) {
  const prev = AQI_ADVICE[AQI_ADVICE.indexOf(band) - 1]
  const inBand = aqi <= band.max && (!prev || aqi > prev.max)
  return inBand ? 1 : 0.35
}

export default function RecommendationsScreen() {
  const { reading, health, loading, refresh } = useAir()
  const [refreshing, setRefreshing] = React.useState(false)

  async function onRefresh() {
    setRefreshing(true)
    await refresh()
    setRefreshing(false)
  }

  if (loading && !reading) return (
    <View style={styles.center}><ActivityIndicator size="large" color="#006aff" /></View>
  )

  const aqi    = reading?.aqi ?? 0
  const meta   = getAqiMeta(aqi)
  const advice = getAqiAdvice(aqi)
  const ctips  = getConditionTips(health?.condition_name)

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#006aff']} />}
    >
      {/* Current AQI advice */}
      <View style={[styles.aqiBanner, { borderLeftColor: advice.color }]}>
        <View style={styles.aqiBannerTop}>
          <Text style={[styles.aqiBannerLabel, { color: advice.color }]}>{advice.label}</Text>
          <Text style={[styles.aqiBannerAqi, { color: advice.color }]}>AQI {aqi}</Text>
        </View>
        <Text style={styles.aqiBannerMsg}>{advice.message}</Text>
      </View>

      {/* Condition-specific tips */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionIcon}>{ctips.icon}</Text>
          <Text style={styles.sectionTitle}>Tips for {ctips.label}</Text>
        </View>
        {ctips.tips.map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <View style={[styles.tipDot, { backgroundColor: meta.color }]} />
            <Text style={styles.tipText}>{tip}</Text>
          </View>
        ))}
      </View>

      {/* AQI action guide */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AQI Action Guide</Text>
        {AQI_ADVICE.map(a => (
          <View key={a.label} style={[styles.guideRow, { opacity: getHighlight(aqi, a) }]}>
            <View style={[styles.guideBar, { backgroundColor: a.color }]} />
            <View style={styles.guideInfo}>
              <Text style={[styles.guideLabel, { color: a.color }]}>{a.label}</Text>
              <Text style={styles.guideMsg}>{a.message}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Protective measures */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Protective Measures</Text>
        {PROTECTIVE.map((item, i) => (
          <View key={i} style={styles.measureCard}>
            <Text style={styles.measureIcon}>{item.icon}</Text>
            <View style={styles.measureBody}>
              <Text style={styles.measureTitle}>{item.title}</Text>
              <Text style={styles.measureDesc}>{item.desc}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  )
}

const PROTECTIVE = [
  { icon: '😷', title: 'N95 Mask', desc: 'Filters 95% of airborne particles including PM2.5. Proper seal is critical — no beard gap.' },
  { icon: '🏠', title: 'Stay Indoors', desc: 'Indoor air can be 2–5× cleaner when windows are shut and an air purifier is running.' },
  { icon: '🌿', title: 'Air Purifier', desc: 'HEPA + activated carbon filter removes PM2.5, NO2, VOCs, and odours effectively.' },
  { icon: '💧', title: 'Hydration', desc: 'Drink 2–3 litres of water daily. Helps flush inhaled pollutants and reduces inflammation.' },
  { icon: '🕗', title: 'Timing Matters', desc: 'AQI is lowest mid-morning (9–11 AM) after traffic disperses. Worst at morning/evening rush.' },
]

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#060913' },
  content:         { padding: 16, paddingBottom: 32 },
  center:          { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#060913' },
  aqiBanner:       { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  aqiBannerTop:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  aqiBannerLabel:  { fontSize: 16, fontWeight: '800' },
  aqiBannerAqi:    { fontSize: 28, fontWeight: '900' },
  aqiBannerMsg:    { fontSize: 14, color: 'rgba(255,255,255,0.70)', lineHeight: 20 },
  section:         { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionIcon:     { fontSize: 20 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: '#ffffff', marginBottom: 0 },
  tipRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  tipDot:          { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  tipText:         { fontSize: 14, color: 'rgba(255,255,255,0.70)', lineHeight: 20, flex: 1 },
  guideRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  guideBar:        { width: 4, borderRadius: 2, alignSelf: 'stretch', minHeight: 40 },
  guideInfo:       { flex: 1 },
  guideLabel:      { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  guideMsg:        { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
  measureCard:     { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 14 },
  measureIcon:     { fontSize: 26, width: 32, textAlign: 'center' },
  measureBody:     { flex: 1 },
  measureTitle:    { fontSize: 14, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  measureDesc:     { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 18 },
})
