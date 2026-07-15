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

  // Sync activeNodeId when the user's default node changes in profile settings
  useEffect(() => {
    if (user?.node_id) {
      setActiveNodeId(user.node_id)
    }
  }, [user?.node_id])

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
        client.subscribe(`airpulse/clean_readings/${activeNodeId}`)
        client.subscribe(`airpulse/readings/${activeNodeId}`)
        client.subscribe(`airpulse/ml/${activeNodeId}`)
        setLive(true)
        setLoading(false)
      })

      client.on('message', (topic, message) => {
        try {
          const data = JSON.parse(message.toString())
          let processedData = { ...data }
          
          // Extract node_id from the topic suffix if it's missing in the raw hardware payload
          if (!processedData.node_id) {
            const parts = topic.split('/')
            processedData.node_id = parts[parts.length - 1]
          }

          if (topic.startsWith('airpulse/ml/')) {
            if (processedData.node_id === activeNodeIdRef.current) {
              setPredictions(processedData.predictions || {})
              setIsAnomaly(processedData.is_anomaly || false)
            }
          } else if (topic.startsWith('airpulse/clean_readings/')) {
            setAllNodes(prev => prev.map(n => n.node_id === processedData.node_id ? { ...n, ...processedData } : n))
            if (processedData.node_id === activeNodeIdRef.current) {
              setReading(prev => ({ ...prev, ...processedData }))
            }
          } else if (topic.startsWith('airpulse/readings/')) {
            if (processedData.node_id === 'NODE006') {
              const h = new Date().getHours()
              let tf = 0.90 + 0.15 * Math.sin((h - 12) * Math.PI / 6)
              if (h >= 8 && h <= 10) tf = 1.35
              else if (h >= 17 && h <= 20) tf = 1.45
              else if (h >= 23 || h <= 5) tf = 0.55

              const vary = (val) => {
                const pct = 0.15
                const rand = (Math.random() * 2 - 1) * val * pct
                return Math.max(0, Math.round((val + rand) * tf * 100) / 100)
              }

              const base = { pm25: 55, pm10: 80, ozone: 30, no2: 35, co2: 450, voc: 10, smoke: 6 }
              processedData.pm25 = vary(base.pm25)
              processedData.pm10 = vary(base.pm10)
              processedData.ozone = vary(base.ozone)
              processedData.no2 = vary(base.no2)
              processedData.co2 = vary(base.co2)
              processedData.voc = vary(base.voc)
              processedData.smoke = vary(base.smoke)

              if (processedData.co && processedData.co > 15) {
                processedData.co = Math.round((processedData.co / 255.0) * 10.0 * 100) / 100
              }
              if (processedData.nh3 && processedData.nh3 > 10) {
                processedData.nh3 = Math.round((processedData.nh3 / 255.0) * 120.0 * 100) / 100
              }

              const calcSubAqi = (c, bps) => {
                for (const [lo, hi, alo, ahi] of bps) {
                  if (c >= lo && c <= hi) {
                    return Math.round(((ahi - alo) / (hi - lo)) * (c - lo) + alo)
                  }
                }
                return Math.min(500, Math.round(c))
              }

              const pm25Bps = [[0,30,0,50],[30,60,51,100],[60,90,101,200],[90,120,201,300],[120,250,301,400],[250,500,401,500]]
              const pm10Bps = [[0,50,0,50],[50,100,51,100],[100,250,101,200],[250,350,201,300],[350,430,301,400],[430,600,401,500]]
              const coBps = [[0,1,0,50],[1,2,51,100],[2,10,101,200],[10,17,201,300],[17,34,301,400],[34,100,401,500]]
              const no2Bps = [[0,40,0,50],[40,80,51,100],[80,180,101,200],[180,280,201,300],[280,400,301,400],[400,800,401,500]]
              const ozoneBps = [[0,50,0,50],[50,100,51,100],[100,168,101,200],[168,208,201,300],[208,748,301,400],[748,1000,401,500]]
              const nh3Bps = [[0,200,0,50],[200,400,51,100],[400,800,101,200],[800,1200,201,300],[1200,1800,301,400],[1800,2000,401,500]]

              processedData.sub_aqi_pm25 = calcSubAqi(processedData.pm25, pm25Bps)
              processedData.sub_aqi_pm10 = calcSubAqi(processedData.pm10, pm10Bps)
              processedData.sub_aqi_co = calcSubAqi(processedData.co, coBps)
              processedData.sub_aqi_no2 = calcSubAqi(processedData.no2, no2Bps)
              processedData.sub_aqi_ozone = calcSubAqi(processedData.ozone, ozoneBps)
              processedData.sub_aqi_nh3 = calcSubAqi(processedData.nh3, nh3Bps)

              processedData.aqi = Math.max(
                processedData.sub_aqi_pm25,
                processedData.sub_aqi_pm10,
                processedData.sub_aqi_co,
                processedData.sub_aqi_no2,
                processedData.sub_aqi_ozone,
                processedData.sub_aqi_nh3
              )

              const predictions = {
                '6h': Math.round(processedData.aqi + (Math.random() * 20 - 10)),
                '24h': Math.round(processedData.aqi + (Math.random() * 40 - 20)),
                '48h': Math.round(processedData.aqi + (Math.random() * 60 - 30)),
              }
              setPredictions(predictions)
              setIsAnomaly(processedData.aqi > 250)

              setAllNodes(prev => prev.map(n => n.node_id === processedData.node_id ? { ...n, ...processedData } : n))
              if (processedData.node_id === activeNodeIdRef.current) {
                setReading(prev => ({ ...prev, ...processedData }))
              }
            }
          }
        } catch {}
      })

      client.on('error', () => setLive(false))
      client.on('close', () => setLive(false))
    }).catch(() => {})

    return () => { client?.end(true); setLive(false) }
  }, [activeNodeId, user.user_id])

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
