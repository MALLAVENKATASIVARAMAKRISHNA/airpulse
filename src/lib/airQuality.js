export const AQI_ALERT_THRESHOLD = 200

export function getAqiMeta(aqi = 0) {
  if (aqi <= 50) return { label: 'Good', color: '#56c596', tone: 'good' }
  if (aqi <= 100) return { label: 'Moderate', color: '#f2c94c', tone: 'moderate' }
  if (aqi <= 150) return { label: 'Sensitive', color: '#f2994a', tone: 'sensitive' }
  if (aqi <= 200) return { label: 'Unhealthy', color: '#eb5757', tone: 'unhealthy' }
  if (aqi <= 300) return { label: 'Very unhealthy', color: '#9b51e0', tone: 'very-unhealthy' }
  return { label: 'Hazardous', color: '#7a2431', tone: 'hazardous' }
}

export function getHealthMessage(aqi, condition, severity) {
  if (aqi <= 50) return 'Air quality is good. Normal outdoor activity is suitable.'
  if (aqi <= 100) {
    return condition === 'Asthma'
      ? 'Air is acceptable. Keep your inhaler available during extended outdoor activity.'
      : 'Air quality is acceptable for normal activity.'
  }
  if (aqi <= 200) {
    return condition === 'Asthma'
      ? `Limit outdoor exertion${severity ? ` due to your ${severity.toLowerCase()} asthma profile` : ''}. Keep medication nearby.`
      : 'Reduce prolonged outdoor exertion if you experience irritation.'
  }
  return condition === 'Asthma'
    ? 'Avoid outdoor activity. Close windows, use a purifier if available, and follow your asthma action plan.'
    : 'Avoid prolonged outdoor activity. Close windows and use a well-fitted mask if you must go outside.'
}

export function formatReadingTime(value) {
  if (!value) return 'No reading'
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export const pollutantConfig = [
  { key: 'pm25', label: 'PM2.5', unit: 'µg/m³', subKey: 'sub_aqi_pm25' },
  { key: 'pm10', label: 'PM10', unit: 'µg/m³', subKey: 'sub_aqi_pm10' },
  { key: 'co', label: 'CO', unit: 'ppm', subKey: 'sub_aqi_co' },
  { key: 'nh3', label: 'NH₃', unit: 'ppm', subKey: 'sub_aqi_nh3' },
]
