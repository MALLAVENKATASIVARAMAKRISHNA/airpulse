const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function getToken()  { return localStorage.getItem('ap_token') || sessionStorage.getItem('ap_token') }
function setToken(t, remember = true) {
  if (remember) {
    localStorage.setItem('ap_token', t)
  } else {
    sessionStorage.setItem('ap_token', t)
  }
}
function clearToken(){
  localStorage.removeItem('ap_token')
  sessionStorage.removeItem('ap_token')
}
function getUser()   {
  const val = localStorage.getItem('ap_user') || sessionStorage.getItem('ap_user')
  return JSON.parse(val || 'null')
}
function setUser(u, remember = true)  {
  if (remember) {
    localStorage.setItem('ap_user', JSON.stringify(u))
  } else {
    sessionStorage.setItem('ap_user', JSON.stringify(u))
  }
}
function clearUser() {
  localStorage.removeItem('ap_user')
  sessionStorage.removeItem('ap_user')
}

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
  updateProfile: (data)         => req('PUT',  '/api/auth/profile', data),
  forgotPassword: (email)       => req('POST', '/api/auth/forgot-password', { email }),
  resetPassword:  (token, password) => req('POST', '/api/auth/reset-password', { token, password }),
  changePassword: (current_password, new_password) => req('POST', '/api/auth/change-password', { current_password, new_password }),

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
  createNode:   (body)   => req('POST', '/api/nodes/', body),

  // ML
  predictions: (nodeId) => req('GET',  `/api/ml/predictions/${nodeId}`),
  hotspots:    ()       => req('GET',  '/api/ml/hotspots'),
  anomalies:   ()       => req('GET',  '/api/ml/anomalies'),
  healthRisk:  (body)   => req('POST', '/api/ml/health-risk', body),

  // Users (admin)
  users:          () => req('GET', '/api/users/'),
  userCount:      () => req('GET', '/api/users/count'),
  updateUserRole: (userId, role) => req('PATCH', `/api/users/${userId}/role`, { role }),
  createAuthority: (data) => req('POST', '/api/users/authority', data),
  adminUpdateUser: (userId, data) => req('PUT', `/api/users/${userId}`, data),

  // Readings (admin)
  insertReading: (data) => req('POST', '/api/readings/', data),

  // Simulation (admin)
  simStatus:   ()             => req('GET',  '/api/simulation/status'),
  simStart:    (secs)         => req('POST', '/api/simulation/start',    { interval_seconds: secs }),
  simStop:     ()             => req('POST', '/api/simulation/stop'),
  simOverride: (node_id, val) => req('POST', '/api/simulation/override', { node_id, ...val }),
  simReset:    (node_id)      => req('POST', '/api/simulation/reset',    { node_id }),

  // IoT
  getIotUrl: () => req('GET', '/api/iot/url'),

  getToken, setToken, clearToken, getUser, setUser, clearUser,
}
