import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Svg, { Path, Circle, Text as SvgText } from 'react-native-svg'
import { getAqiMeta } from '../lib/airQuality'

const SIZE   = 240
const CX     = SIZE / 2
const CY     = SIZE / 2
const R      = 95
const SW     = 16
const START  = 150
const END    = 390

function polarToXY(angleDeg, r) {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) }
}

function arcPath(startDeg, endDeg, r) {
  const s   = polarToXY(startDeg, r)
  const e   = polarToXY(endDeg,   r)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`
}

export default function AqiGauge({ aqi = 0 }) {
  const meta     = getAqiMeta(aqi)
  const fillEnd  = START + (END - START) * Math.min(aqi / 500, 1)

  return (
    <View style={styles.wrap}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Track */}
        <Path
          d={arcPath(START, END, R)}
          fill="none"
          stroke="#1e1e1e"
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* Fill */}
        <Path
          d={arcPath(START, fillEnd, R)}
          fill="none"
          stroke={meta.color}
          strokeWidth={SW}
          strokeLinecap="round"
        />
        {/* AQI number */}
        <SvgText
          x={CX}
          y={CY - 8}
          textAnchor="middle"
          fontSize={54}
          fontWeight="800"
          fill="#ffffff"
        >
          {aqi}
        </SvgText>
        {/* Label */}
        <SvgText
          x={CX}
          y={CY + 26}
          textAnchor="middle"
          fontSize={17}
          fontWeight="700"
          fill={meta.color}
        >
          {meta.label}
        </SvgText>
        {/* Unit */}
        <SvgText
          x={CX}
          y={CY + 48}
          textAnchor="middle"
          fontSize={11}
          fill="rgba(255,255,255,0.35)"
        >
          AQI · CPCB Scale
        </SvgText>
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
})
