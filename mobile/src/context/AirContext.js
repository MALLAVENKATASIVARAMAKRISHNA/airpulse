import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import mqtt from 'mqtt'
import { api } from '../lib/api'

const AirContext = createContext(null)

export function AirProvider({ user, children }) {
  const [activeNodeId, setActiveNodeId] = useState(user.node_id || 'NODE001')
  const [reading,     setReading]     = useState(null)
  const [allNodes,    setAllNodes]    = useState([])
  const [health,      setHealth]      = useState(null)
  const [predictions, setPredictions] = useState(null)
  const [isAnomaly,   setIsAnomaly]   = useState(false)
  const [loading,     setLoading]     = useState(true)
  const [live,        setLive]        = useState(false)
  
  const healthLoaded = useRef(false)
  const activeNodeIdRef = useRef(activeNodeId)

  // Keep ref synchronized to avoid rebuilding MQTT client on location change
  useEffect(() => {
    activeNodeIdRef.current = activeNodeId
  }, [activeNodeId])

  const load = useCallback(async () => {
    try {
      const tasks = [
        api.latestAll(),
        api.predictions(activeNodeId).catch(() => [])
      ]
      if (!healthLoaded.current) {
        tasks.push(api.getHealth().catch(() => null))
      }
      const results  = await Promise.all(tasks)
      const nodes    = results[0] || []
      const predRows = results[1] || []
      
      const currentNode = nodes.find(n => n.node_id === activeNodeId) || nodes[0] || null
      setAllNodes(nodes)
      setReading(currentNode)
      setIsAnomaly(currentNode?.is_anomaly || false)
      
      if (predRows.length) {
        setPredictions({
          '6h':  predRows.find(r => r.horizon === '6h')?.predicted_aqi  ?? null,
          '24h': predRows.find(r => r.horizon === '24h')?.predicted_aqi ?? null,
          '48h': predRows.find(r => r.horizon === '48h')?.predicted_aqi ?? null,
        })
      }

      const healthIndex = 2
      if (!healthLoaded.current && results[healthIndex] !== undefined) {
        setHealth(results[healthIndex])
        healthLoaded.current = true
      }
    } catch {}
    setLoading(false)
  }, [activeNodeId])

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
            if (data.node_id === activeNodeIdRef.current) {
              setPredictions(data.predictions || {})
              setIsAnomaly(data.is_anomaly || false)
            }
          } else if (topic.startsWith('airpulse/clean_readings/')) {
            setAllNodes(prev => prev.map(n => n.node_id === data.node_id ? { ...n, ...data } : n))
            if (data.node_id === activeNodeIdRef.current) {
              setReading(prev => ({ ...prev, ...data }))
            }
          }
        } catch {}
      })

      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})

    return () => { client?.end(true); setLive(false) }
  }, [user.user_id])

  return (
    <AirContext.Provider value={{
      reading, allNodes, health, predictions, isAnomaly, loading, live,
      refresh: load, user, activeNodeId, setActiveNodeId
    }}>
      {children}
    </AirContext.Provider>
  )
}

export const useAir = () => useContext(AirContext)
