const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getToken()  { return localStorage.getItem('ap_token') }
function setToken(t) { localStorage.setItem('ap_token', t) }
function clearToken(){ localStorage.removeItem('ap_token') }
function getUser()   { return JSON.parse(localStorage.getItem('ap_user') || 'null') }
function setUser(u)  { localStorage.setItem('ap_user', JSON.stringify(u)) }
function clearUser() { localStorage.removeItem('ap_user') }

async function req(method, path, body) {
  const token = getToken()
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
  // Auth
  login:      (email, password) => req('POST', '/api/auth/login', { email, password }),
  signup:     (data)            => req('POST', '/api/auth/signup', data),
  me:         ()                => req('GET',  '/api/auth/me'),

  // Health
  conditions: ()     => req('GET',  '/api/auth/conditions'),
  saveHealth: (data) => req('POST', '/api/auth/health', data),
  getHealth:  ()     => req('GET',  '/api/auth/health'),

  // Alerts history
  alertHistory: () => req('GET', '/api/auth/alerts'),

  // Nodes
  nodes:        ()       => req('GET', '/api/nodes/'),
  latestAll:    ()       => req('GET', '/api/nodes/latest'),
  nodeReadings: (nodeId) => req('GET', `/api/nodes/${nodeId}/readings`),

  // ML
  predictions: (nodeId) => req('GET',  `/api/ml/predictions/${nodeId}`),
  hotspots:    ()       => req('GET',  '/api/ml/hotspots'),
  anomalies:   ()       => req('GET',  '/api/ml/anomalies'),
  healthRisk:  (body)   => req('POST', '/api/ml/health-risk', body),

  // Users (admin)
  users:     () => req('GET', '/api/users/'),
  userCount: () => req('GET', '/api/users/count'),

  // Readings (admin)
  insertReading: (data) => req('POST', '/api/readings/', data),

  // Simulation (admin)
  simStatus:   ()             => req('GET',  '/api/simulation/status'),
  simStart:    (secs)         => req('POST', '/api/simulation/start',    { interval_seconds: secs }),
  simStop:     ()             => req('POST', '/api/simulation/stop'),
  simOverride: (node_id, val) => req('POST', '/api/simulation/override', { node_id, ...val }),
  simReset:    (node_id)      => req('POST', '/api/simulation/reset',    { node_id }),

  getToken, setToken, clearToken, getUser, setUser, clearUser,
}
