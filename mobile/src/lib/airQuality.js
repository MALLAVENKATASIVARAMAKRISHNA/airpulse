export function getAqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',         color: '#00C853', bg: '#E8F5E9', text: '#1B5E20' }
  if (aqi <= 100) return { label: 'Satisfactory',  color: '#76C442', bg: '#F1F8E9', text: '#33691E' }
  if (aqi <= 200) return { label: 'Moderate',      color: '#F9A825', bg: '#FFFDE7', text: '#F57F17' }
  if (aqi <= 300) return { label: 'Poor',          color: '#EF5350', bg: '#FFEBEE', text: '#B71C1C' }
  if (aqi <= 400) return { label: 'Very Poor',     color: '#AB47BC', bg: '#F3E5F5', text: '#6A1B9A' }
  return              { label: 'Severe',           color: '#7B1FA2', bg: '#EDE7F6', text: '#4A148C' }
}

export const POLLUTANTS = [
  { key: 'pm25',  label: 'PM2.5', unit: 'µg/m³', limit: 60,  color: '#EF5350', subKey: 'sub_aqi_pm25' },
  { key: 'pm10',  label: 'PM10',  unit: 'µg/m³', limit: 100, color: '#FF7043', subKey: 'sub_aqi_pm10' },
  { key: 'co',    label: 'CO',    unit: 'mg/m³',  limit: 10,  color: '#FFA726', subKey: 'sub_aqi_co'   },
  { key: 'nh3',   label: 'NH3',   unit: 'µg/m³', limit: 400, color: '#FFCA28', subKey: 'sub_aqi_nh3'  },
  { key: 'no2',   label: 'NO2',   unit: 'µg/m³', limit: 80,  color: '#AB47BC', subKey: 'sub_aqi_no2'  },
  { key: 'ozone', label: 'Ozone', unit: 'µg/m³', limit: 100, color: '#42A5F5', subKey: 'sub_aqi_ozone'},
]

export function getSeverityLabel(value, limit) {
  const r = value / limit
  if (r < 0.5) return 'Safe'
  if (r < 0.8) return 'Moderate'
  if (r < 1.0) return 'High'
  return 'Exceeds Limit'
}

export function getSeverityColor(value, limit) {
  const r = value / limit
  if (r < 0.5) return '#00C853'
  if (r < 0.8) return '#F9A825'
  if (r < 1.0) return '#FF7043'
  return '#EF5350'
}

// ─── Clinical threshold system ────────────────────────────────────────────────
// Sources: CPCB NAAQS 2009, WHO AQG 2021, GINA 2023, GOLD 2024, AHA, ACOG
// Section 5 (age-group thresholds) + Section 6 (disease × age) from
// AirPulse_Health_Reference.docx
//
// Returns { warn, alert }
//   warn  — "limit outdoor activity" AQI (shows danger banner)
//   alert — "stay indoors" AQI (triggers full-screen alert + push notification)
//
export function getThresholds(conditionName, severityLevel, age) {
  const cond = (conditionName ?? '').toLowerCase()
  const yr   = parseInt(age) || 30

  // Age group classification (Section 5)
  const infant    = yr <= 2
  const child     = yr >= 3  && yr <= 12
  const teen      = yr >= 13 && yr <= 18
  const adult     = yr >= 19 && yr <= 59
  const elderly   = yr >= 60

  let warn, alert

  // ── Asthma (GINA 2023; Section 6) ──────────────────────────────────────────
  if (cond.includes('asthma')) {
    if (infant || child)  { warn = 100; alert = 200 }  // Children 3–12
    else if (teen)        { warn = 101; alert = 201 }  // Adolescents 13–18
    else if (elderly)     { warn = 101; alert = 200 }  // Elderly 60+
    else                  { warn = 151; alert = 301 }  // Adults 19–60

  // ── COPD (GOLD 2024; Section 6) ────────────────────────────────────────────
  } else if (cond.includes('copd')) {
    if (elderly)          { warn = 101; alert = 200 }  // Elderly 60+
    else                  { warn = 151; alert = 301 }  // Adults 40–60

  // ── Heart / Cardiovascular (AHA Brook 2010; Section 6) ─────────────────────
  } else if (cond.includes('heart')) {
    if (elderly)          { warn = 101; alert = 200 }  // Elderly 60+
    else                  { warn = 151; alert = 300 }  // Adults 30–60

  // ── Diabetes (Brook 2016; Liu 2016; Section 6) ─────────────────────────────
  } else if (cond.includes('diabetes')) {
    if (elderly)          { warn = 101; alert = 201 }  // Elderly
    else                  { warn = 151; alert = 301 }  // Adults

  // ── Children condition tag (Section 5) ─────────────────────────────────────
  } else if (cond.includes('children')) {
    if (infant)           { warn = 100; alert = 200 }  // Infants 0–2
    else                  { warn = 100; alert = 201 }  // Children 3–12

  // ── Elderly condition tag (Section 5) ──────────────────────────────────────
  } else if (cond.includes('elderly')) {
    warn = 101; alert = 201

  // ── Normal / healthy (Section 5 age-based standard) ────────────────────────
  } else {
    if (infant)           { warn = 100; alert = 200 }
    else if (child)       { warn = 100; alert = 201 }
    else if (teen)        { warn = 101; alert = 301 }
    else if (elderly)     { warn = 101; alert = 201 }
    else                  { warn = 201; alert = 401 }  // Healthy adults 19–60
  }

  // Severity modifier (High → more sensitive → lower threshold)
  const mod = severityLevel === 'High' ? -25 : severityLevel === 'Low' ? 25 : 0
  return {
    warn:  Math.max(50,  warn  + mod),
    alert: Math.max(75,  alert + mod),
  }
}

// Convenience — alert threshold only (used in AlertWatcher + notifications.py)
export function getAlertThreshold(conditionName, severityLevel, age) {
  return getThresholds(conditionName, severityLevel, age).alert
}

// Convenience — warn threshold only (used in HomeScreen danger banner)
export function getWarnThreshold(conditionName, severityLevel, age) {
  return getThresholds(conditionName, severityLevel, age).warn
}
