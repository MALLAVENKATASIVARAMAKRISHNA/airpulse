import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native'
import { useAir } from '../context/AirContext'
import { getAqiMeta, getThresholds } from '../lib/airQuality'
import { api } from '../lib/api'

const RISK_COLORS = {
  'LOW':       '#3DD9AC',
  'MODERATE':  '#E8B84B',
  'HIGH':      '#FF7043',
  'VERY HIGH': '#FF6B6B',
  'CRITICAL':  '#A78BFA',
}

function getActionItems(aqi, conditionName) {
  const cond = (conditionName || '').toLowerCase()
  const hasCond = cond.includes('asthma') || cond.includes('copd') ||
                  cond.includes('heart') || cond.includes('diabetes')

  if (aqi <= 50) return [
    { icon: '✅', text: 'Safe for all outdoor activities' },
    { icon: '🏃', text: 'Exercise outdoors without restriction' },
    { icon: '🪟', text: 'Open windows for fresh air' },
  ]
  if (aqi <= 100) return [
    { icon: '✅', text: 'Generally safe for most people' },
    { icon: '⚠️', text: hasCond ? 'Keep rescue medication handy' : 'Sensitive individuals should limit exertion' },
    { icon: '🧘', text: 'Reduce high-intensity outdoor exercise' },
  ]
  if (aqi <= 200) return [
    { icon: '😷', text: hasCond ? 'Wear a mask outdoors' : 'Consider a mask for long outdoor stays' },
    { icon: '🏠', text: hasCond ? 'Prefer indoor activities today' : 'Limit prolonged outdoor exertion' },
    { icon: '💊', text: hasCond ? 'Follow your medication schedule strictly' : 'Monitor symptoms if sensitive' },
    { icon: '🪟', text: 'Keep windows closed during peak hours' },
  ]
  if (aqi <= 300) return [
    { icon: '🚫', text: 'Avoid all non-essential outdoor activity' },
    { icon: '😷', text: 'Wear N95 mask if you must go outside' },
    { icon: '🏠', text: 'Stay indoors with windows closed' },
    { icon: '🌀', text: 'Run air purifier if available' },
    { icon: '💊', text: hasCond ? 'Have emergency medication accessible' : 'Watch for irritation symptoms' },
  ]
  return [
    { icon: '🚨', text: 'STAY INDOORS — Severe air quality' },
    { icon: '😷', text: 'Wear N95 or P100 mask if you must go outside' },
    { icon: '🪟', text: 'Seal gaps around doors and windows' },
    { icon: '🌀', text: 'Run air purifier on maximum setting' },
    { icon: '🏥', text: hasCond ? 'Seek medical advice immediately if symptomatic' : 'Seek help if you feel unwell' },
  ]
}

function getMaskRecommendation(aqi) {
  if (aqi <= 50)  return { mask: 'None needed',  color: '#3DD9AC' }
  if (aqi <= 100) return { mask: 'Optional',      color: '#E8B84B' }
  if (aqi <= 200) return { mask: 'Surgical mask', color: '#FF7043' }
  if (aqi <= 300) return { mask: 'N95 mask',      color: '#FF6B6B' }
  return                 { mask: 'N95/P100 mask', color: '#A78BFA' }
}

function getActivityLevel(aqi, hasCondition) {
  if (aqi <= 50)  return { level: 'Unrestricted', color: '#3DD9AC', desc: 'All outdoor activities safe' }
  if (aqi <= 100) return { level: hasCondition ? 'Light only' : 'Normal', color: '#E8B84B', desc: hasCondition ? 'Avoid strenuous exercise' : 'Reduce prolonged outdoor activity' }
  if (aqi <= 200) return { level: 'Indoors preferred', color: '#FF7043', desc: 'Keep outdoor time minimal' }
  if (aqi <= 300) return { level: 'Avoid outdoors', color: '#FF6B6B', desc: 'Only essential outdoor trips' }
  return                 { level: 'Stay indoors', color: '#A78BFA', desc: 'No outdoor activity' }
}

export default function HealthAssessmentScreen() {
  const { reading, health } = useAir()
  const [healthRisk, setHealthRisk] = useState(null)
  const [loading,    setLoading]    = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const aqi  = reading?.aqi ?? 0
  const meta = getAqiMeta(aqi)

  const condName  = health?.condition_name ?? 'Normal'
  const severity  = health?.severity_level ?? 'None'
  const age       = health?.age ?? 30
  const thresholds = getThresholds(condName, severity, age)

  const hasCond = (condName || '').toLowerCase() !== 'normal' &&
                  (condName || '').trim().length > 0

  async function load() {
    if (!aqi) return
    setLoading(true)
    try {
      const p6 = aqi, p24 = aqi, p48 = aqi
      const risk = await api.healthRisk({ current_aqi: aqi, future6: p6, future24: p24, future48: p48 })
      setHealthRisk(risk)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [aqi])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  const riskScore = healthRisk?.risk_score ?? Math.max(0, Math.round(100 - (aqi / thresholds.alert) * 80))
  const riskLevel = healthRisk?.risk_level ?? (aqi < thresholds.warn ? 'LOW' : aqi < thresholds.alert ? 'MODERATE' : 'HIGH')
  const riskColor = RISK_COLORS[riskLevel] ?? '#E8B84B'
  const actions   = getActionItems(aqi, condName)
  const maskRec   = getMaskRecommendation(aqi)
  const activity  = getActivityLevel(aqi, hasCond)

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3DD9AC" colors={['#3DD9AC']} />}
    >
      <Text style={s.pageTitle}>Health Assessment</Text>
      <Text style={s.pageSub}>Personalised for your health profile</Text>

      {/* Health profile summary */}
      <View style={s.profileCard}>
        <View style={s.profileRow}>
          <View style={s.profileItem}>
            <Text style={s.profileLabel}>Condition</Text>
            <Text style={s.profileValue}>{condName}</Text>
          </View>
          <View style={s.profileItem}>
            <Text style={s.profileLabel}>Severity</Text>
            <Text style={s.profileValue}>{severity}</Text>
          </View>
          <View style={s.profileItem}>
            <Text style={s.profileLabel}>Age</Text>
            <Text style={s.profileValue}>{age}y</Text>
          </View>
        </View>
      </View>

      {/* Current AQI + Risk Score */}
      <View style={s.riskCard}>
        <View style={s.riskTop}>
          <View style={s.aqiSide}>
            <Text style={s.riskAqiLabel}>Current AQI</Text>
            <Text style={[s.riskAqi, { color: meta.color }]}>{aqi}</Text>
            <View style={[s.riskBadge, { backgroundColor: meta.color + '22' }]}>
              <Text style={[s.riskBadgeText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </View>
          <View style={s.scoreSide}>
            <Text style={s.riskScoreLabel}>Risk Score</Text>
            <Text style={[s.riskScoreVal, { color: riskColor }]}>{riskScore}</Text>
            <Text style={[s.riskLevel, { color: riskColor }]}>{riskLevel}</Text>
          </View>
        </View>
        <View style={s.riskBarTrack}>
          <View style={[s.riskBarFill, { width: `${riskScore}%`, backgroundColor: riskColor }]} />
        </View>
        <Text style={s.riskNote}>Lower score = higher risk. 100 = completely safe.</Text>
      </View>

      {/* Thresholds */}
      <Text style={s.sectionTitle}>Your Personal Thresholds</Text>
      <View style={s.thresholdRow}>
        <View style={[s.thresholdCard, { backgroundColor: '#241e0a', borderColor: '#E8B84B40' }]}>
          <Text style={s.thresholdIcon}>⚠️</Text>
          <Text style={[s.thresholdAqi, { color: '#E8B84B' }]}>{thresholds.warn}</Text>
          <Text style={[s.thresholdName, { color: '#E8B84B' }]}>Warning</Text>
          <Text style={s.thresholdDesc}>Limit outdoor activity</Text>
          {aqi >= thresholds.warn && <View style={s.exceededBadge}><Text style={s.exceededText}>EXCEEDED</Text></View>}
        </View>
        <View style={[s.thresholdCard, { backgroundColor: '#200e0e', borderColor: '#FF6B6B40' }]}>
          <Text style={s.thresholdIcon}>🚨</Text>
          <Text style={[s.thresholdAqi, { color: '#FF6B6B' }]}>{thresholds.alert}</Text>
          <Text style={[s.thresholdName, { color: '#FF6B6B' }]}>Alert</Text>
          <Text style={s.thresholdDesc}>Stay indoors</Text>
          {aqi >= thresholds.alert && <View style={[s.exceededBadge, { backgroundColor: '#FF6B6B' }]}><Text style={s.exceededText}>EXCEEDED</Text></View>}
        </View>
      </View>

      {/* Protection details */}
      <Text style={s.sectionTitle}>Protection Details</Text>
      <View style={s.protectionRow}>
        <View style={[s.protCard, { backgroundColor: maskRec.color + '15' }]}>
          <Text style={s.protIcon}>😷</Text>
          <Text style={s.protLabel}>Mask</Text>
          <Text style={[s.protValue, { color: maskRec.color }]}>{maskRec.mask}</Text>
        </View>
        <View style={[s.protCard, { backgroundColor: activity.color + '15' }]}>
          <Text style={s.protIcon}>🏃</Text>
          <Text style={s.protLabel}>Activity</Text>
          <Text style={[s.protValue, { color: activity.color }]}>{activity.level}</Text>
        </View>
      </View>
      {activity.desc && (
        <Text style={s.activityDesc}>{activity.desc}</Text>
      )}

      {/* Action items */}
      <Text style={s.sectionTitle}>What You Should Do</Text>
      <View style={s.actionCard}>
        {actions.map((item, i) => (
          <View key={i} style={[s.actionItem, i < actions.length - 1 && s.actionDivider]}>
            <Text style={s.actionIcon}>{item.icon}</Text>
            <Text style={s.actionText}>{item.text}</Text>
          </View>
        ))}
      </View>

      {healthRisk?.advice && (
        <View style={s.adviceCard}>
          <Text style={s.adviceText}>{healthRisk.advice}</Text>
        </View>
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0a' },
  content:        { padding: 16, paddingBottom: 40 },
  pageTitle:      { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  pageSub:        { fontSize: 13, color: 'rgba(255,255,255,0.40)', marginBottom: 16 },

  profileCard:    { backgroundColor: '#161616', borderRadius: 16, padding: 16, marginBottom: 16 },
  profileRow:     { flexDirection: 'row', gap: 8 },
  profileItem:    { flex: 1, alignItems: 'center' },
  profileLabel:   { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 4 },
  profileValue:   { fontSize: 14, fontWeight: '700', color: '#ffffff', textAlign: 'center' },

  riskCard:       { backgroundColor: '#161616', borderRadius: 20, padding: 18, marginBottom: 20 },
  riskTop:        { flexDirection: 'row', marginBottom: 16 },
  aqiSide:        { flex: 1, alignItems: 'flex-start' },
  riskAqiLabel:   { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 6 },
  riskAqi:        { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  riskBadge:      { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 6 },
  riskBadgeText:  { fontSize: 12, fontWeight: '700' },
  scoreSide:      { flex: 1, alignItems: 'flex-end' },
  riskScoreLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', marginBottom: 6 },
  riskScoreVal:   { fontSize: 48, fontWeight: '900', lineHeight: 52 },
  riskLevel:      { fontSize: 13, fontWeight: '700', marginTop: 4 },
  riskBarTrack:   { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  riskBarFill:    { height: 6, borderRadius: 3 },
  riskNote:       { fontSize: 11, color: 'rgba(255,255,255,0.30)' },

  sectionTitle:   { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },

  thresholdRow:   { flexDirection: 'row', gap: 10, marginBottom: 20 },
  thresholdCard:  { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1 },
  thresholdIcon:  { fontSize: 22, marginBottom: 8 },
  thresholdAqi:   { fontSize: 36, fontWeight: '900' },
  thresholdName:  { fontSize: 13, fontWeight: '700', marginTop: 2, marginBottom: 4 },
  thresholdDesc:  { fontSize: 11, color: 'rgba(255,255,255,0.40)', textAlign: 'center' },
  exceededBadge:  { backgroundColor: '#E8B84B', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8 },
  exceededText:   { fontSize: 9, fontWeight: '800', color: '#0a0a0a', letterSpacing: 0.5 },

  protectionRow:  { flexDirection: 'row', gap: 10, marginBottom: 8 },
  protCard:       { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  protIcon:       { fontSize: 24, marginBottom: 8 },
  protLabel:      { fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: '600', marginBottom: 4 },
  protValue:      { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  activityDesc:   { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 20, textAlign: 'center' },

  actionCard:     { backgroundColor: '#161616', borderRadius: 18, padding: 4, marginBottom: 16 },
  actionItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  actionDivider:  { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  actionIcon:     { fontSize: 18, width: 24, textAlign: 'center' },
  actionText:     { flex: 1, fontSize: 14, color: 'rgba(255,255,255,0.80)', lineHeight: 20 },

  adviceCard:     { backgroundColor: '#161616', borderRadius: 14, padding: 14 },
  adviceText:     { fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 19 },
})
