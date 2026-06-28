import { Storage } from './storage'

const BASE = 'https://airpulse-api.onrender.com'

async function req(method, path, body) {
  const token = await Storage.getToken()
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.detail || 'Request failed')
  return data
}

export const api = {
  login:        (email, password) => req('POST', '/api/auth/login', { email, password }),
  signup:       (data)            => req('POST', '/api/auth/signup', data),
  me:           ()                => req('GET',  '/api/auth/me'),
  conditions:   ()                => req('GET',  '/api/auth/conditions'),
  saveHealth:   (data)            => req('POST', '/api/auth/health', data),
  getHealth:    ()                => req('GET',  '/api/auth/health'),
  savePushToken:(token)           => req('POST', '/api/auth/push-token', { token }),
  nodes:        ()                => req('GET',  '/api/nodes/'),
  latestAll:    ()                => req('GET',  '/api/nodes/latest'),
  nodeReadings: (nodeId)          => req('GET',  `/api/nodes/${nodeId}/readings`),
  predictions:  (nodeId)          => req('GET',  `/api/ml/predictions/${nodeId}`),
  hotspots:     ()                => req('GET',  '/api/ml/hotspots'),
  anomalies:    ()                => req('GET',  '/api/ml/anomalies'),
  healthRisk:   (body)            => req('POST', '/api/ml/health-risk', body),
}
