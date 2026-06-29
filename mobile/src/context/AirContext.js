import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { api } from '../lib/api'

const AirContext = createContext(null)

export function AirProvider({ user, children }) {
  const [reading,  setReading]  = useState(null)
  const [allNodes, setAllNodes] = useState([])
  const [health,   setHealth]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const healthLoaded = useRef(false)

  const load = useCallback(async () => {
    try {
      const tasks = [api.latestAll()]
      if (!healthLoaded.current) tasks.push(api.getHealth().catch(() => null))

      const results = await Promise.all(tasks)
      const nodes   = results[0] || []
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

  // Initial load + poll every 30s
  useEffect(() => {
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [load])

  return (
    <AirContext.Provider value={{ reading, allNodes, health, loading, refresh: load, user }}>
      {children}
    </AirContext.Provider>
  )
}

export const useAir = () => useContext(AirContext)
