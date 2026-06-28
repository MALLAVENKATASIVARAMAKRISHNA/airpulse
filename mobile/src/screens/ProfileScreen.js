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
  const { onLogout } = route.params
  const { user: ctxUser, health: ctxHealth } = useAir()

  const [user, setUser]             = useState(ctxUser)
  const [conditions, setConditions] = useState([])
  const [saving, setSaving]         = useState(false)
  const [condModal, setCondModal]   = useState(false)
  const [sevModal, setSevModal]     = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const [form, setForm] = useState({
    conditionId:   ctxHealth?.condition_id   ?? 1,
    conditionName: ctxHealth?.condition_name ?? 'Normal',
    severity:      ctxHealth?.severity_level ?? 'None',
    age:           String(ctxHealth?.age || ''),
    gender:        ctxHealth?.gender || '',
  })

  useEffect(() => {
    Promise.all([api.me(), api.getHealth().catch(() => null), api.conditions()])
      .then(([u, h, conds]) => {
        setUser(u)
        setConditions(conds || [])
        if (h) {
          setForm({
            conditionId:   h.condition_id,
            conditionName: h.condition_name,
            severity:      h.severity_level,
            age:           String(h.age || ''),
            gender:        h.gender || '',
          })
        }
      })
      .catch(() => {})
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
        <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? 'rgba(0,200,83,0.15)' : 'rgba(0,106,255,0.15)' }]}>
          <Text style={[styles.roleText, { color: user?.role === 'admin' ? '#00C853' : '#006aff' }]}>
            {user?.role?.toUpperCase() ?? 'USER'}
          </Text>
        </View>
      </View>

      {/* Account info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <InfoRow label="Node ID"             value={user?.node_id  || 'Not assigned'} />
        <InfoRow label="Monitoring location" value={user?.location || 'Not assigned'} />
        <InfoRow label="Email"               value={user?.email    || '—'} />
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
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>Save health profile</Text>
          }
        </TouchableOpacity>
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>

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

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#060913' },
  content:          { padding: 16, paddingBottom: 40 },
  section:          { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 24, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  avatar:           { width: 72, height: 72, borderRadius: 36, backgroundColor: '#006aff', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  avatarText:       { fontSize: 32, fontWeight: '700', color: '#fff' },
  name:             { fontSize: 20, fontWeight: '800', color: '#ffffff', marginBottom: 4 },
  email:            { fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 10 },
  roleBadge:        { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 20 },
  roleText:         { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  card:             { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  cardTitle:        { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 14 },
  infoRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)' },
  infoLabel:        { fontSize: 13, color: 'rgba(255,255,255,0.45)' },
  infoValue:        { fontSize: 13, fontWeight: '600', color: '#ffffff', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  thresholdCard:    { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  thresholdTitle:   { fontSize: 16, fontWeight: '700', color: '#ffffff', marginBottom: 2 },
  thresholdSub:     { fontSize: 12, color: 'rgba(255,255,255,0.40)', marginBottom: 14 },
  thresholdRow:     { flexDirection: 'row', gap: 10, marginBottom: 12 },
  thresholdBox:     { flex: 1, borderWidth: 2, borderRadius: 14, padding: 14, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)' },
  thresholdLabel:   { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.55)', marginBottom: 6 },
  thresholdVal:     { fontSize: 34, fontWeight: '900', marginBottom: 2 },
  thresholdDesc:    { fontSize: 11, color: 'rgba(255,255,255,0.40)', textAlign: 'center' },
  thresholdNote:    { fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 8 },
  label:            { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6, marginTop: 12 },
  select:           { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:       { fontSize: 15, color: '#ffffff' },
  arrow:            { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  input:            { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.07)' },
  genderRow:        { flexDirection: 'row', gap: 8, marginTop: 0 },
  genderBtn:        { flex: 1, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  genderActive:     { borderColor: '#006aff', backgroundColor: 'rgba(0,106,255,0.15)' },
  genderText:       { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  genderTextActive: { color: '#006aff' },
  success:          { color: '#10d343', fontSize: 13, fontWeight: '600', marginTop: 12 },
  saveBtn:          { backgroundColor: '#006aff', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 },
  saveBtnText:      { color: '#fff', fontSize: 15, fontWeight: '700' },
  logoutBtn:        { backgroundColor: 'rgba(239,83,80,0.10)', borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(239,83,80,0.30)' },
  logoutText:       { color: '#EF5350', fontSize: 15, fontWeight: '700' },
})
