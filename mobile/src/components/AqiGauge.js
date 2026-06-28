import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Circle, Text as SvgText } from 'react-native-svg'
import { getAqiMeta } from '../lib/airQuality'

const SIZE = 220
const STROKE = 18
const R = (SIZE - STROKE) / 2
const CX = SIZE / 2
const CY = SIZE / 2
const CIRC = 2 * Math.PI * R
const GAUGE = CIRC * (240 / 360)
const GAP   = CIRC - GAUGE

export default function AqiGauge({ aqi = 0 }) {
  const meta     = getAqiMeta(aqi)
  const progress = GAUGE * Math.min(aqi / 500, 1)

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={STROKE}
          strokeDasharray={`${GAUGE} ${GAP}`}
          strokeLinecap="round"
          transform={`rotate(150, ${CX}, ${CY})`}
        />
        <Circle
          cx={CX} cy={CY} r={R}
          fill="none"
          stroke={meta.color}
          strokeWidth={STROKE}
          strokeDasharray={`${progress} ${CIRC - progress}`}
          strokeLinecap="round"
          transform={`rotate(150, ${CX}, ${CY})`}
        />
        <SvgText
          x={CX} y={CY + 6}
          textAnchor="middle"
          fontSize={52}
          fontWeight="bold"
          fill={meta.color}
        >
          {aqi}
        </SvgText>
        <SvgText
          x={CX} y={CY + 30}
          textAnchor="middle"
          fontSize={13}
          fill="rgba(255,255,255,0.45)"
        >
          AQI
        </SvgText>
      </Svg>

      <View style={[styles.badge, { backgroundColor: meta.color + '28' }]}>
        <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap:  { alignItems: 'center' },
  badge: { marginTop: 4, paddingHorizontal: 20, paddingVertical: 6, borderRadius: 20 },
  label: { fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
})
