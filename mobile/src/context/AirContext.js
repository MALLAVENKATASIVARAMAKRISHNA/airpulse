import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import mqtt from 'mqtt'
import { api } from '../lib/api'

const AirContext = createContext(null)

export function AirProvider({ user, children }) {
  const [reading,     setReading]     = useState(null)
  const [allNodes,    setAllNodes]    = useState([])
  const [health,      setHealth]      = useState(null)
  const [predictions, setPredictions] = useState({})
  const [isAnomaly,   setIsAnomaly]   = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [live,        setLive]        = useState(false)
  const healthLoaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const tasks = [api.latestAll()]
      if (!healthLoaded.current) tasks.push(api.getHealth().catch(() => null))
      const results  = await Promise.all(tasks)
      const nodes    = results[0] || []
      const userNode = nodes.find(n => n.node_id === user.node_id) || nodes[0] || null
      setAllNodes(nodes)
      setReading(userNode)
      if (!healthLoaded.current && results[1] !== undefined) {
        setHealth(results[1])
        healthLoaded.current = true
      }
    } catch {}
    setLoading(false)
  }, [user.node_id])

  // Initial load + fallback poll every 5 minutes
  useEffect(() => {
    load()
    const id = setInterval(load, 300000)
    return () => clearInterval(id)
  }, [load])

  // MQTT — real-time sensor data + ML predictions from IoT Core
  useEffect(() => {
    let client
    api.getIotUrl().then(({ url }) => {
      client = mqtt.connect(url, {
        clientId: `mobile-${user.user_id}-${Date.now()}`,
        reconnectPeriod: 5000,
      })

      client.on('connect', () => {
        client.subscribe('airpulse/clean_readings/#')
        client.subscribe('airpulse/ml/#')
        setLive(true)
        setLoading(false)
      })

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString())
          if (topic.startsWith('airpulse/ml/')) {
            if (data.node_id === user.node_id) {
              setPredictions(data.predictions || {})
              setIsAnomaly(data.is_anomaly || false)
            }
          } else if (topic.startsWith('airpulse/clean_readings/')) {
            setAllNodes(prev => prev.map(n => n.node_id === data.node_id ? { ...n, ...data } : n))
            if (data.node_id === user.node_id) {
              setReading(prev => ({ ...prev, ...data }))
            }
          }
        } catch {}
      })

      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})

    return () => { client?.end(true); setLive(false) }
  }, [user.node_id, user.user_id])

  return (
    <AirContext.Provider value={{ reading, allNodes, health, predictions, isAnomaly, loading, live, refresh: load, user }}>
      {children}
    </AirContext.Provider>
  )
}

export const useAir = () => useContext(AirContext)
