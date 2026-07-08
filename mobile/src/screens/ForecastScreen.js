import React, { useEffect, useState } from 'react'
import { View, Text, ScrollView, RefreshControl, StyleSheet, Dimensions, ActivityIndicator } from 'react-native'
import Svg, { Rect, Path, Circle, Text as SvgText, Line } from 'react-native-svg'
import { useAir } from '../context/AirContext'
import { getAqiMeta } from '../lib/airQuality'
import { api } from '../lib/api'

const SW = Dimensions.get('window').width
const CHART_W = SW - 32
const CHART_H = 220
const PAD = { top: 24, right: 16, bottom: 40, left: 44 }
const CW = CHART_W - PAD.left - PAD.right
const CH = CHART_H - PAD.top - PAD.bottom

const AQI_BANDS = [
  { min: 0,   max: 50,  color: '#00C853', label: 'Good' },
  { min: 50,  max: 100, color: '#76C442', label: 'Satisfactory' },
  { min: 100, max: 200, color: '#F9A825', label: 'Moderate' },
  { min: 200, max: 300, color: '#EF5350', label: 'Poor' },
  { min: 300, max: 400, color: '#AB47BC', label: 'Very Poor' },
  { min: 400, max: 500, color: '#7B1FA2', label: 'Severe' },
]

const HORIZON_LABELS = ['Now', '+6h', '+24h', '+48h']

function aqiToY(aqi) {
  return PAD.top + CH - (Math.min(Math.max(aqi, 0), 500) / 500) * CH
}

function xAt(i) {
  return PAD.left + (CW / 3) * i
}

function trendArrow(prev, curr) {
  const diff = curr - prev
  if (Math.abs(diff) <= 5) return { arrow: '→', color: '#A0A0A0' }
  return diff > 0
    ? { arrow: '↑', color: '#EF5350' }
    : { arrow: '↓', color: '#3DD9AC' }
}

function formatPredictedTime(hoursOffset) {
  const d = new Date(Date.now() + hoursOffset * 3600000)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function ForecastScreen() {
  const { reading, predictions: mlPredictions, user, live } = useAir()
  const [dbPredictions, setDbPredictions] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  const currentAqi = reading?.aqi ?? 0

  useEffect(() => {
    if (!mlPredictions && user?.node_id) {
      api.predictions(user.node_id)
        .then(rows => {
          if (!rows?.length) return
          setDbPredictions({
            '6h':  rows.find(r => r.horizon === '6h')?.predicted_aqi  ?? null,
            '24h': rows.find(r => r.horizon === '24h')?.predicted_aqi ?? null,
            '48h': rows.find(r => r.horizon === '48h')?.predicted_aqi ?? null,
          })
        }).catch(() => {})
    }
  }, [user?.node_id, mlPredictions])

  const preds = mlPredictions ?? dbPredictions
  const p6  = preds?.['6h']  ?? currentAqi
  const p24 = preds?.['24h'] ?? currentAqi
  const p48 = preds?.['48h'] ?? currentAqi

  const points = [currentAqi, p6, p24, p48]

  async function onRefresh() {
    setRefreshing(true)
    try {
      const rows = await api.predictions(user.node_id)
      if (rows?.length) {
        setDbPredictions({
          '6h':  rows.find(r => r.horizon === '6h')?.predicted_aqi  ?? null,
          '24h': rows.find(r => r.horizon === '24h')?.predicted_aqi ?? null,
          '48h': rows.find(r => r.horizon === '48h')?.predicted_aqi ?? null,
        })
      }
    } catch {}
    setRefreshing(false)
  }

  // Build SVG line path
  const linePath = points.map((aqi, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${aqiToY(aqi)}`).join(' ')

  const horizonCards = [
    { label: '+6h',  aqi: p6,  time: formatPredictedTime(6),  prev: currentAqi },
    { label: '+24h', aqi: p24, time: formatPredictedTime(24), prev: p6 },
    { label: '+48h', aqi: p48, time: formatPredictedTime(48), prev: p24 },
  ]

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3DD9AC" colors={['#3DD9AC']} />}
    >
      <Text style={s.pageTitle}>AQI Forecast</Text>
      <View style={s.subRow}>
        <Text style={s.pageSub}>GradientBoosting model · 6h / 24h / 48h horizon</Text>
        {live && <Text style={s.liveTag}>⚡ Live</Text>}
      </View>

      {/* Current AQI summary */}
      <View style={[s.currentCard, { borderLeftColor: getAqiMeta(currentAqi).color }]}>
        <Text style={s.currentLabel}>Current AQI</Text>
        <View style={s.currentRow}>
          <Text style={[s.currentAqi, { color: getAqiMeta(currentAqi).color }]}>{currentAqi}</Text>
          <View style={[s.currentBadge, { backgroundColor: getAqiMeta(currentAqi).color + '22' }]}>
            <Text style={[s.currentBadgeText, { color: getAqiMeta(currentAqi).color }]}>
              {getAqiMeta(currentAqi).label}
            </Text>
          </View>
        </View>
        <Text style={s.currentLocation}>📍 {reading?.location || '—'}</Text>
      </View>

      {/* SVG Chart */}
      <View style={s.chartCard}>
        <Text style={s.chartTitle}>AQI Forecast Timeline</Text>
        <Svg width={CHART_W} height={CHART_H}>
          {/* AQI band backgrounds */}
          {AQI_BANDS.map(band => {
            const y1 = aqiToY(band.max)
            const y2 = aqiToY(band.min)
            return (
              <Rect
                key={band.label}
                x={PAD.left}
                y={y1}
                width={CW}
                height={y2 - y1}
                fill={band.color}
                opacity={0.10}
              />
            )
          })}

          {/* Vertical grid lines */}
          {[0, 1, 2, 3].map(i => (
            <Line
              key={i}
              x1={xAt(i)} y1={PAD.top}
              x2={xAt(i)} y2={PAD.top + CH}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
            />
          ))}

          {/* Horizontal Y-axis labels */}
          {[0, 100, 200, 300, 400, 500].map(v => (
            <SvgText
              key={v}
              x={PAD.left - 6}
              y={aqiToY(v) + 4}
              textAnchor="end"
              fontSize={9}
              fill="rgba(255,255,255,0.30)"
            >
              {v}
            </SvgText>
          ))}

          {/* Line */}
          <Path d={linePath} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1.5} strokeDasharray="4 3" />

          {/* Colored line segments between points */}
          {points.slice(0, -1).map((aqi, i) => {
            const nextAqi = points[i + 1]
            const midAqi = (aqi + nextAqi) / 2
            return (
              <Path
                key={i}
                d={`M ${xAt(i)} ${aqiToY(aqi)} L ${xAt(i + 1)} ${aqiToY(nextAqi)}`}
                fill="none"
                stroke={getAqiMeta(midAqi).color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            )
          })}

          {/* Dots + AQI labels above dots */}
          {points.map((aqi, i) => {
            const meta = getAqiMeta(aqi)
            const cx = xAt(i)
            const cy = aqiToY(aqi)
            return (
              <React.Fragment key={i}>
                {/* Outer glow ring */}
                <Circle cx={cx} cy={cy} r={10} fill={meta.color} opacity={0.18} />
                {/* Dot */}
                <Circle cx={cx} cy={cy} r={5} fill={meta.color} stroke="#0a0a0a" strokeWidth={2} />
                {/* AQI label above dot */}
                <Rect
                  x={cx - 18} y={cy - 34}
                  width={36} height={20}
                  rx={5}
                  fill="#1e1e1e"
                />
                <SvgText
                  x={cx} y={cy - 20}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight="700"
                  fill={meta.color}
                >
                  {aqi}
                </SvgText>
              </React.Fragment>
            )
          })}

          {/* X-axis labels */}
          {HORIZON_LABELS.map((label, i) => (
            <SvgText
              key={label}
              x={xAt(i)}
              y={PAD.top + CH + 22}
              textAnchor="middle"
              fontSize={11}
              fontWeight="600"
              fill="rgba(255,255,255,0.50)"
            >
              {label}
            </SvgText>
          ))}
        </Svg>

        {/* Band legend */}
        <View style={s.legend}>
          {AQI_BANDS.map(b => (
            <View key={b.label} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: b.color }]} />
              <Text style={s.legendText}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Horizon cards */}
      <Text style={s.sectionTitle}>Predicted Values</Text>
      <View style={s.horizonRow}>
        {horizonCards.map(h => {
          const meta = getAqiMeta(h.aqi)
          const trend = trendArrow(h.prev, h.aqi)
          const diff = h.aqi - h.prev
          return (
            <View key={h.label} style={[s.horizonCard, { backgroundColor: meta.color + '15', borderColor: meta.color + '40' }]}>
              <Text style={[s.horizonHorizon, { color: meta.color }]}>{h.label}</Text>
              <View style={s.horizonAqiRow}>
                <Text style={[s.horizonAqi, { color: meta.color }]}>{h.aqi}</Text>
                <Text style={[s.horizonArrow, { color: trend.color }]}>{trend.arrow}</Text>
              </View>
              <Text style={[s.horizonLabel, { color: meta.color }]}>{meta.label}</Text>
              <Text style={s.horizonDiff}>
                {diff === 0 ? 'No change' : `${diff > 0 ? '+' : ''}${diff} AQI`}
              </Text>
              <Text style={s.horizonTime}>{h.time}</Text>
            </View>
          )
        })}
      </View>

      {/* Interpretation note */}
      <View style={s.noteCard}>
        <Text style={s.noteText}>
          Predictions are generated by a GradientBoosting model trained on historical AQI readings, weather data, and time-of-day patterns from your monitoring node.
        </Text>
      </View>
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0a0a0a' },
  content:        { padding: 16, paddingBottom: 40 },
  pageTitle:      { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 4, marginTop: 4 },
  subRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  pageSub:        { fontSize: 13, color: 'rgba(255,255,255,0.40)', flex: 1 },
  liveTag:        { fontSize: 11, fontWeight: '700', color: '#3DD9AC' },

  currentCard:    { backgroundColor: '#161616', borderRadius: 16, padding: 16, marginBottom: 16, borderLeftWidth: 3 },
  currentLabel:   { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.40)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  currentRow:     { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  currentAqi:     { fontSize: 42, fontWeight: '900' },
  currentBadge:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10 },
  currentBadgeText:{ fontSize: 14, fontWeight: '700' },
  currentLocation:{ fontSize: 13, color: 'rgba(255,255,255,0.40)' },

  chartCard:      { backgroundColor: '#161616', borderRadius: 20, padding: 16, marginBottom: 20 },
  chartTitle:     { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  legend:         { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  legendItem:     { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot:      { width: 8, height: 8, borderRadius: 4 },
  legendText:     { fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },

  sectionTitle:   { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  horizonRow:     { flexDirection: 'row', gap: 8, marginBottom: 16 },
  horizonCard:    { flex: 1, borderRadius: 16, padding: 12, borderWidth: 1 },
  horizonHorizon: { fontSize: 11, fontWeight: '800', marginBottom: 8 },
  horizonAqiRow:  { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 2 },
  horizonAqi:     { fontSize: 26, fontWeight: '900' },
  horizonArrow:   { fontSize: 18, fontWeight: '900', marginBottom: 2 },
  horizonLabel:   { fontSize: 11, fontWeight: '600', marginBottom: 6 },
  horizonDiff:    { fontSize: 10, color: 'rgba(255,255,255,0.40)', marginBottom: 2 },
  horizonTime:    { fontSize: 10, color: 'rgba(255,255,255,0.30)' },

  noteCard:       { backgroundColor: '#161616', borderRadius: 14, padding: 14 },
  noteText:       { fontSize: 12, color: 'rgba(255,255,255,0.40)', lineHeight: 18 },
})
