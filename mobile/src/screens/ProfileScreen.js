import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native'
import { api } from '../lib/api'
import { Storage } from '../lib/storage'
import { useAir } from '../context/AirContext'
import { getThresholds } from '../lib/airQuality'
import SelectModal from '../components/SelectModal'

const SEVERITIES = [
  { value: 'None',   label: 'None — No known severity' },
  { value: 'Low',    label: 'Low — Mild symptoms' },
  { value: 'Medium', label: 'Medium — Moderate symptoms' },
  { value: 'High',   label: 'High — Severe symptoms' },
]

export default function ProfileScreen({ route, navigation }) {
  const { onUpdateUser, onLogout } = route.params
  const { user: ctxUser, health: ctxHealth } = useAir()

  const [user, setUser]             = useState(ctxUser)
  const [nodes, setNodes]           = useState([])
  const [conditions, setConditions] = useState([])
  const [saving, setSaving]         = useState(false)
  const [condModal, setCondModal]   = useState(false)
  const [sevModal, setSevModal]     = useState(false)
  const [nodeModal, setNodeModal]   = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    conditionId:   ctxHealth?.condition_id   ?? 1,
    conditionName: ctxHealth?.condition_name ?? 'Normal',
    severity:      ctxHealth?.severity_level ?? 'None',
    age:           String(ctxHealth?.age || ''),
    gender:        ctxHealth?.gender || '',
  })

  const [profileForm, setProfileForm] = useState({
    full_name: ctxUser?.full_name || '',
    email:     ctxUser?.email     || '',
    node_id:   ctxUser?.node_id   || '',
  })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg,    setProfileMsg]    = useState('')

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg,    setPwMsg]    = useState('')

  useEffect(() => {
    Promise.all([
      api.me(),
      api.getHealth().catch(() => null),
      api.conditions(),
      api.nodes().catch(() => []),
    ]).then(([u, h, conds, ns]) => {
      setUser(u)
      setConditions(conds || [])
      setNodes(ns || [])
      setProfileForm({ full_name: u.full_name || '', email: u.email || '', node_id: u.node_id || '' })
      if (h) {
        setForm({
          conditionId:   h.condition_id,
          conditionName: h.condition_name,
          severity:      h.severity_level,
          age:           String(h.age || ''),
          gender:        h.gender || '',
        })
      }
    }).catch(() => {})
  }, [])

  function update(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function saveHealth() {
    if (!form.age || parseInt(form.age) <= 0) {
      Alert.alert('Missing info', 'Please enter your age.')
      return
    }
    setSaving(true)
    setSuccessMsg('')
    try {
      await api.saveHealth({
        condition_id:   form.conditionId,
        severity_level: form.severity,
        age:            parseInt(form.age) || 0,
        gender:         form.gender,
      })
      setSuccessMsg('Health profile saved successfully.')
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setSaving(false)
  }

  async function saveProfile() {
    if (!profileForm.full_name.trim()) {
      Alert.alert('Missing info', 'Full name is required.')
      return
    }
    setProfileSaving(true)
    setProfileMsg('')
    try {
      const updated = await api.updateProfile({
        full_name: profileForm.full_name.trim(),
        email:     profileForm.email.trim(),
        node_id:   profileForm.node_id || null,
      })
      setUser(u => ({ ...u, ...updated }))
      if (onUpdateUser) {
        onUpdateUser(updated)
      }
      setProfileMsg('Profile updated successfully.')
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setProfileSaving(false)
  }

  async function changePassword() {
    if (!pwForm.current || !pwForm.next) {
      Alert.alert('Missing info', 'Fill in all password fields.')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      Alert.alert('Mismatch', 'New passwords do not match.')
      return
    }
    if (pwForm.next.length < 6) {
      Alert.alert('Too short', 'Password must be at least 6 characters.')
      return
    }
    setPwSaving(true)
    setPwMsg('')
    try {
      await api.changePassword({ current_password: pwForm.current, new_password: pwForm.next })
      setPwMsg('Password changed successfully.')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e) {
      Alert.alert('Error', e.message)
    }
    setPwSaving(false)
  }

  function logout() {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => { await Storage.clear(); onLogout() },
      },
    ])
  }

  const conditionOptions = conditions.map(c => ({ value: c.condition_id, label: c.condition_name }))
  const nodeOptions      = nodes.map(n => ({ value: n.node_id, label: `${n.location} (${n.node_id})` }))
  const selectedNodeLabel = nodes.find(n => n.node_id === profileForm.node_id)?.location || profileForm.node_id || 'Select node'

  const age = parseInt(form.age) || 30
  const thresholds = getThresholds(form.conditionName, form.severity, age)

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>

      {/* User info */}
      <View style={styles.section}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.[0]?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.full_name ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? '—'}</Text>
        <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? 'rgba(0,200,83,0.15)' : 'rgba(61,217,172,0.12)' }]}>
          <Text style={[styles.roleText, { color: user?.role === 'admin' ? '#00C853' : '#3DD9AC' }]}>
            {user?.role?.toUpperCase() ?? 'USER'}
          </Text>
        </View>
      </View>

      {/* AQI Threshold card */}
      <View style={styles.thresholdCard}>
        <Text style={styles.thresholdTitle}>Your Personal AQI Thresholds</Text>
        <Text style={styles.thresholdSub}>Based on your health profile</Text>
        <View style={styles.thresholdRow}>
          <View style={[styles.thresholdBox, { borderColor: '#FFA726' }]}>
            <Text style={styles.thresholdLabel}>⚠️ Warning</Text>
            <Text style={[styles.thresholdVal, { color: '#FFA726' }]}>{thresholds.warn}</Text>
            <Text style={styles.thresholdDesc}>Limit outdoor activity</Text>
          </View>
          <View style={[styles.thresholdBox, { borderColor: '#EF5350' }]}>
            <Text style={styles.thresholdLabel}>🚨 Alert</Text>
            <Text style={[styles.thresholdVal, { color: '#EF5350' }]}>{thresholds.alert}</Text>
            <Text style={styles.thresholdDesc}>Stay indoors</Text>
          </View>
        </View>
        <Text style={styles.thresholdNote}>
          Push notifications trigger when AQI ≥ {thresholds.alert}
        </Text>
      </View>

      {/* Edit Profile */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Edit Profile</Text>

        <Text style={styles.label}>Full name</Text>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={profileForm.full_name}
          onChangeText={v => setProfileForm(f => ({ ...f, full_name: v }))}
        />

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="email-address"
          autoCapitalize="none"
          value={profileForm.email}
          onChangeText={v => setProfileForm(f => ({ ...f, email: v }))}
        />

        <Text style={styles.label}>Monitoring node</Text>
        <TouchableOpacity style={styles.select} onPress={() => setNodeModal(true)}>
          <Text style={styles.selectText}>{selectedNodeLabel}</Text>
          <Text style={styles.arrow}>▾</Text>
        </TouchableOpacity>

        {!!profileMsg && <Text style={styles.success}>{profileMsg}</Text>}

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile} disabled={profileSaving}>
          {profileSaving
            ? <ActivityIndicator color="#0a1a14" />
            : <Text style={styles.saveBtnText}>Save profile</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Health profile */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Health Profile</Text>

        <Text style={styles.label}>Health condition</Text>
        <TouchableOpacity style={styles.select} onPress={() => setCondModal(true)}>
          <Text style={styles.selectText}>{form.conditionName || 'Select condition'}</Text>
          <Text style={styles.arrow}>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Condition severity</Text>
        <TouchableOpacity style={styles.select} onPress={() => setSevModal(true)}>
          <Text style={styles.selectText}>{form.severity || 'Select severity'}</Text>
          <Text style={styles.arrow}>▾</Text>
        </TouchableOpacity>

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="Your age"
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="numeric"
          value={form.age}
          onChangeText={v => update('age', v)}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {['Male', 'Female', 'Other'].map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, form.gender === g && styles.genderActive]}
              onPress={() => update('gender', g)}
            >
              <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>{g}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!successMsg && <Text style={styles.success}>{successMsg}</Text>}

        <TouchableOpacity style={styles.saveBtn} onPress={saveHealth} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#0a1a14" />
            : <Text style={styles.saveBtnText}>Save health profile</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Change Password */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Change Password</Text>

        <Text style={styles.label}>Current password</Text>
        <TextInput
          style={styles.input}
          placeholder="Current password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={pwForm.current}
          onChangeText={v => setPwForm(f => ({ ...f, current: v }))}
        />

        <Text style={styles.label}>New password</Text>
        <TextInput
          style={styles.input}
          placeholder="New password (min 6 chars)"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={pwForm.next}
          onChangeText={v => setPwForm(f => ({ ...f, next: v }))}
        />

        <Text style={styles.label}>Confirm new password</Text>
        <TextInput
          style={styles.input}
          placeholder="Repeat new password"
          placeholderTextColor="rgba(255,255,255,0.3)"
          secureTextEntry
          value={pwForm.confirm}
          onChangeText={v => setPwForm(f => ({ ...f, confirm: v }))}
        />

        {!!pwMsg && <Text style={styles.success}>{pwMsg}</Text>}

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#404040' }]} onPress={changePassword} disabled={pwSaving}>
          {pwSaving
            ? <ActivityIndicator color="#fff" />
            : <Text style={[styles.saveBtnText, { color: '#ffffff' }]}>Change password</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>

      <SelectModal
        visible={nodeModal}
        title="Monitoring node"
        options={nodeOptions}
        onSelect={item => setProfileForm(f => ({ ...f, node_id: item.value }))}
        onClose={() => setNodeModal(false)}
      />
      <SelectModal
        visible={condModal}
        title="Health condition"
        options={conditionOptions}
        onSelect={item => { update('conditionId', item.value); update('conditionName', item.label) }}
        onClose={() => setCondModal(false)}
      />
      <SelectModal
        visible={sevModal}
        title="Condition severity"
        options={SEVERITIES}
        onSelect={item => update('severity', item.value)}
        onClose={() => setSevModal(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#0a0a0a' },
  content:          { padding: 16, paddingBottom: 40 },
  section:          { alignItems: 'center', backgroundColor: '#161616', borderRadius: 20, padding: 24, marginBottom: 12 },
  avatar:           { width: 72, height: 72, borderRadius: 36, backgroundColor: '#1e2e28', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 2, borderColor: '#3DD9AC' },
  avatarText:       { fontSize: 32, fontWeight: '700', color: '#3DD9AC' },
  name:             { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  email:            { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 10 },
  roleBadge:        { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleText:         { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  card:             { backgroundColor: '#161616', borderRadius: 18, padding: 16, marginBottom: 12 },
  cardTitle:        { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 14 },
  thresholdCard:    { backgroundColor: '#161616', borderRadius: 18, padding: 16, marginBottom: 12 },
  thresholdTitle:   { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  thresholdSub:     { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 14 },
  thresholdRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  thresholdBox:     { flex: 1, borderWidth: 1.5, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: '#0f0f0f' },
  thresholdLabel:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.50)', marginBottom: 6 },
  thresholdVal:     { fontSize: 34, fontWeight: '900', marginBottom: 2 },
  thresholdDesc:    { fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center' },
  thresholdNote:    { fontSize: 12, color: 'rgba(255,255,255,0.40)', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 8 },
  label:            { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.45)', marginBottom: 6, marginTop: 12 },
  select:           { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#1e1e1e', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:       { fontSize: 15, color: '#ffffff' },
  arrow:            { fontSize: 16, color: 'rgba(255,255,255,0.35)' },
  input:            { borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#ffffff', backgroundColor: '#1e1e1e' },
  genderRow:        { flexDirection: 'row', gap: 8, marginTop: 0 },
  genderBtn:        { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', alignItems: 'center', backgroundColor: '#1e1e1e' },
  genderActive:     { borderColor: '#3DD9AC', backgroundColor: 'rgba(61,217,172,0.12)' },
  genderText:       { fontSize: 14, color: 'rgba(255,255,255,0.40)', fontWeight: '600' },
  genderTextActive: { color: '#3DD9AC' },
  success:          { color: '#3DD9AC', fontSize: 13, fontWeight: '600', marginTop: 12 },
  saveBtn:          { backgroundColor: '#3DD9AC', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText:      { color: '#0a1a14', fontSize: 15, fontWeight: '800' },
  logoutBtn:        { backgroundColor: 'rgba(255,107,107,0.08)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,107,107,0.25)' },
  logoutText:       { color: '#FF6B6B', fontSize: 15, fontWeight: '700' },
})
