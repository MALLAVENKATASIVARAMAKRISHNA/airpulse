import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Circle, Path } from 'react-native-svg'
import { LinearGradient } from 'expo-linear-gradient'
import { api } from '../lib/api'
import { Storage } from '../lib/storage'
import SelectModal from '../components/SelectModal'

function friendlyError(msg) {
  const m = msg?.toLowerCase() ?? ''
  if (m.includes('already exists'))    return 'An account with this email already exists.'
  if (m.includes('incorrect email'))   return 'Incorrect email or password.'
  if (m.includes('not authenticated')) return 'Session expired. Please sign in again.'
  if (m.includes('invalid monitoring'))return 'Please select a monitoring location.'
  return msg
}

function AirPulseLogo() {
  return (
    <View style={styles.logoWrap}>
      <Svg width={72} height={72} viewBox="0 0 100 100">
        <Defs>
          <SvgGradient id="lgrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#3DD9AC" />
            <Stop offset="1" stopColor="#10d343" />
          </SvgGradient>
        </Defs>
        <Circle cx="50" cy="50" r="48" fill="url(#lgrad)" />
        <Path
          d="M 10 50 L 28 50 L 36 62 L 46 18 L 56 82 L 66 38 L 74 50 L 90 50"
          stroke="white" strokeWidth="7" strokeLinecap="round"
          strokeLinejoin="round" fill="none"
        />
      </Svg>
      <Text style={styles.logoName}>
        air<Text style={styles.logoAccent}>pulse</Text>
      </Text>
      <Text style={styles.logoSub}>AI Monitor</Text>
    </View>
  )
}

export default function AuthScreen({ onLogin, onSignup }) {
  const [mode, setMode]           = useState('login')
  const [nodes, setNodes]         = useState([])
  const [loading, setLoading]     = useState(false)
  const [message, setMessage]     = useState('')
  const [nodeModal, setNodeModal] = useState(false)
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', nodeId: '', nodeName: '', phone: '',
  })

  useEffect(() => {
    api.nodes().then(data => {
      if (data?.length) {
        setNodes(data)
        setForm(f => ({ ...f, nodeId: data[0].node_id, nodeName: `${data[0].location}, ${data[0].district}` }))
      }
    }).catch(() => {})
  }, [])

  function update(key, val) { setForm(f => ({ ...f, [key]: val })) }

  async function submit() {
    setLoading(true)
    setMessage('')
    try {
      const res = mode === 'login'
        ? await api.login(form.email, form.password)
        : await api.signup({ full_name: form.fullName, email: form.email, password: form.password, node_id: form.nodeId, phone_number: form.phone })
      await Storage.setToken(res.token)
      await Storage.setUser(res.user)
      if (mode === 'login') {
        onLogin(res.user)
      } else {
        onSignup(res.user)
      }
    } catch (err) {
      setMessage(friendlyError(err.message))
    }
    setLoading(false)
  }

  const nodeOptions = nodes.map(n => ({ value: n.node_id, label: `${n.location}, ${n.district}` }))

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">

        <AirPulseLogo />

        <View style={styles.card}>
          <Text style={styles.welcome}>Welcome to AirPulse</Text>
          <Text style={styles.title}>{mode === 'login' ? 'Sign in to your account' : 'Create your account'}</Text>

          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, mode === 'login' && styles.tabActive]}
              onPress={() => { setMode('login'); setMessage('') }}
            >
              <Text style={[styles.tabText, mode === 'login' && styles.tabTextActive]}>Sign in</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, mode === 'signup' && styles.tabActive]}
              onPress={() => { setMode('signup'); setMessage('') }}
            >
              <Text style={[styles.tabText, mode === 'signup' && styles.tabTextActive]}>Sign up</Text>
            </TouchableOpacity>
          </View>

          {mode === 'signup' && (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your full name"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={form.fullName}
                onChangeText={v => update('fullName', v)}
              />

              <Text style={styles.label}>Monitoring location</Text>
              <TouchableOpacity style={styles.select} onPress={() => setNodeModal(true)}>
                <Text style={form.nodeName ? styles.selectText : styles.selectPlaceholder}>
                  {form.nodeName || 'Select location'}
                </Text>
                <Text style={styles.selectArrow}>▾</Text>
              </TouchableOpacity>

              <Text style={styles.label}>Phone number <Text style={styles.optional}>(Optional)</Text></Text>
              <TextInput
                style={styles.input}
                placeholder="Your phone number"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="phone-pad"
                value={form.phone}
                onChangeText={v => update('phone', v)}
              />
            </>
          )}

          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="rgba(255,255,255,0.3)"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={v => update('email', v)}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Minimum 6 characters"
            placeholderTextColor="rgba(255,255,255,0.3)"
            secureTextEntry
            value={form.password}
            onChangeText={v => update('password', v)}
          />

          {!!message && <Text style={styles.error}>{message}</Text>}

          <TouchableOpacity onPress={submit} disabled={loading} activeOpacity={0.85}>
            <LinearGradient
              colors={['#3DD9AC', '#60A5FA']}
              start={[0, 0]} end={[1, 0]}
              style={styles.btn}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.btnText}>{mode === 'login' ? 'Sign in' : 'Create account'}</Text>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <SelectModal
          visible={nodeModal}
          title="Select monitoring location"
          options={nodeOptions}
          onSelect={item => update('nodeName', item.label) || update('nodeId', item.value)}
          onClose={() => setNodeModal(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container:        { flexGrow: 1, backgroundColor: '#0a0a0a', paddingBottom: 40 },
  logoWrap:         { alignItems: 'center', paddingTop: 60, paddingBottom: 28 },
  logoName:         { fontSize: 28, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5, marginTop: 14 },
  logoAccent:       { color: '#3DD9AC' },
  logoSub:          { fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 },
  card:             { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 24, marginHorizontal: 16, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)' },
  welcome:          { fontSize: 12, fontWeight: '600', color: '#3DD9AC', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  title:            { fontSize: 22, fontWeight: '800', color: '#ffffff', marginBottom: 20 },
  tabs:             { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, padding: 3, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tab:              { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive:        { backgroundColor: 'rgba(0,106,255,0.25)' },
  tabText:          { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.4)' },
  tabTextActive:    { color: '#ffffff' },
  label:            { fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.5)', marginBottom: 6, marginTop: 4 },
  optional:         { fontWeight: '400', color: 'rgba(255,255,255,0.3)' },
  input:            { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, color: '#ffffff', marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.07)' },
  select:           { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.07)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText:       { fontSize: 15, color: '#ffffff' },
  selectPlaceholder:{ fontSize: 15, color: 'rgba(255,255,255,0.3)' },
  selectArrow:      { fontSize: 16, color: 'rgba(255,255,255,0.4)' },
  error:            { color: '#FF5252', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  btn:              { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnText:          { color: '#fff', fontSize: 16, fontWeight: '700' },
})
