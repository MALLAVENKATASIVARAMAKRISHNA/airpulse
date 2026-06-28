import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator,
} from 'react-native'
import { api } from '../lib/api'
import SelectModal from '../components/SelectModal'

const SEVERITIES = [
  { value: 'None',   label: 'None — No known severity' },
  { value: 'Low',    label: 'Low — Mild symptoms' },
  { value: 'Medium', label: 'Medium — Moderate symptoms' },
  { value: 'High',   label: 'High — Severe symptoms' },
]

export default function HealthSetupScreen({ onComplete }) {
  const [conditions, setConditions] = useState([])
  const [saving, setSaving]         = useState(false)
  const [condModal, setCondModal]   = useState(false)
  const [sevModal, setSevModal]     = useState(false)
  const [error, setError]           = useState('')

  const [form, setForm] = useState({
    conditionId: 1, conditionName: 'Normal',
    severity: 'None', age: '', gender: '',
  })

  useEffect(() => {
    api.conditions().then(data => {
      setConditions(data || [])
    }).catch(() => {})
  }, [])

  function update(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function save() {
    if (!form.age || !form.gender) {
      setError('Please fill in your age and gender.')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api.saveHealth({
        condition_id:   form.conditionId,
        severity_level: form.severity,
        age:            parseInt(form.age) || 0,
        gender:         form.gender,
      })
      onComplete()
    } catch (e) {
      setError(e.message || 'Could not save. Please try again.')
      setSaving(false)
    }
  }

  const conditionOptions = conditions.map(c => ({ value: c.condition_id, label: c.condition_name }))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>🫁</Text>
        </View>
        <Text style={styles.step}>Step 1 of 1</Text>
        <Text style={styles.title}>Set up your health profile</Text>
        <Text style={styles.subtitle}>
          AirPulse uses this to personalise your AQI alerts and health guidance.
          You can update it anytime from your profile.
        </Text>
      </View>

      <View style={styles.card}>

        <Text style={styles.label}>Health condition</Text>
        <TouchableOpacity style={styles.select} onPress={() => setCondModal(true)}>
          <Text style={styles.selectText}>{form.conditionName}</Text>
          <Text style={styles.arrow}>▾</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>Select your primary health condition if any</Text>

        <Text style={styles.label}>Condition severity</Text>
        <TouchableOpacity style={styles.select} onPress={() => setSevModal(true)}>
          <Text style={styles.selectText}>{form.severity}</Text>
          <Text style={styles.arrow}>▾</Text>
        </TouchableOpacity>
        <Text style={styles.hint}>How severe is your condition on average</Text>

        <Text style={styles.label}>Age</Text>
        <TextInput
          style={styles.input}
          placeholder="Your age"
          placeholderTextColor="rgba(255,255,255,0.3)"
          keyboardType="numeric"
          value={form.age}
          onChangeText={v => update('age', v)}
          maxLength={3}
        />

        <Text style={styles.label}>Gender</Text>
        <View style={styles.genderRow}>
          {['Male', 'Female', 'Other'].map(g => (
            <TouchableOpacity
              key={g}
              style={[styles.genderBtn, form.gender === g && styles.genderActive]}
              onPress={() => update('gender', g)}
            >
              <Text style={[styles.genderText, form.gender === g && styles.genderTextActive]}>
                {g}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.btnText}>Get Started →</Text>
          }
        </TouchableOpacity>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoIcon}>🔒</Text>
        <Text style={styles.infoText}>
          Your health data stays private and is only used to calculate your personal AQI alert threshold.
        </Text>
      </View>

      <SelectModal
        visible={condModal}
        title="Select health condition"
        options={conditionOptions}
        onSelect={item => { update('conditionId', item.value); update('conditionName', item.label) }}
        onClose={() => setCondModal(false)}
      />
      <SelectModal
        visible={sevModal}
        title="Select condition severity"
        options={SEVERITIES}
        onSelect={item => update('severity', item.value)}
        onClose={() => setSevModal(false)}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#060913' },
  content:         { padding: 20, paddingBottom: 48 },
  header:          { alignItems: 'center', marginBottom: 24, paddingTop: 20 },
  iconWrap:        { width: 72, height: 72, borderRadius: 36, backgroundColor: 'rgba(0,106,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  icon:            { fontSize: 36 },
  step:            { fontSize: 12, fontWeight: '700', color: '#006aff', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  title:           { fontSize: 24, fontWeight: '900', color: '#ffffff', textAlign: 'center', marginBottom: 10 },
  subtitle:        { fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', lineHeight: 21, paddingHorizontal: 8 },
  card:            { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)', marginBottom: 16 },
  label:           { fontSize: 13, fontWeight: '700', color: 'rgba(255,255,255,0.5)', marginBottom: 8, marginTop: 16 },
  select:          { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:      { fontSize: 15, color: '#ffffff' },
  arrow:           { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  hint:            { fontSize: 12, color: 'rgba(255,255,255,0.25)', marginTop: 5 },
  input:           { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, color: '#ffffff', backgroundColor: 'rgba(255,255,255,0.07)' },
  genderRow:       { flexDirection: 'row', gap: 10 },
  genderBtn:       { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  genderActive:    { borderColor: '#006aff', backgroundColor: 'rgba(0,106,255,0.15)' },
  genderText:      { fontSize: 14, color: 'rgba(255,255,255,0.45)', fontWeight: '600' },
  genderTextActive:{ color: '#006aff', fontWeight: '700' },
  error:           { color: '#FF5252', fontSize: 13, marginTop: 14, fontWeight: '500' },
  btn:             { backgroundColor: '#006aff', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20 },
  btnText:         { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  infoRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  infoIcon:        { fontSize: 16 },
  infoText:        { flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 19 },
})
