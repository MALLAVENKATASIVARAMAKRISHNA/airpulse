import { useEffect, useState, useRef } from 'react'
import { MapPin, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '../lib/api'

function aqiMeta(aqi) {
  if (aqi <= 50)  return { label: 'Good',        color: '#00E400', bg: 'rgba(0,228,0,0.1)' }
  if (aqi <= 100) return { label: 'Satisfactory', color: '#76C442', bg: 'rgba(118,196,66,0.1)' }
  if (aqi <= 200) return { label: 'Moderate',     color: '#FFFF00', bg: 'rgba(255,255,0,0.1)' }
  if (aqi <= 300) return { label: 'Poor',         color: '#FF7E00', bg: 'rgba(255,126,0,0.1)' }
  if (aqi <= 400) return { label: 'Very Poor',    color: '#FF0000', bg: 'rgba(255,0,0,0.1)' }
  return               { label: 'Severe',         color: '#8F3F97', bg: 'rgba(143,63,151,0.1)' }
}

export default function HotspotPage({ profile }) {
  const [nodes,    setNodes]    = useState([])
  const [clusters, setClusters] = useState([])
  const [loading,  setLoading]  = useState(true)

  const mapRef = useRef(null)
  const markersRef = useRef([])

  async function load() {
    setLoading(true)
    try {
      const [n, c] = await Promise.all([api.latestAll(), api.hotspots()])
      setNodes((n || []).sort((a, b) => (b.aqi || 0) - (a.aqi || 0)))
      setClusters(c || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Manage Leaflet Map lifecycle
  useEffect(() => {
    if (!window.L || loading || !nodes.length) return

    // Initialize Map if not present
    if (!mapRef.current) {
      const map = window.L.map('hotspot-map', {
        center: [13.0827, 80.2707],
        zoom: 11,
        zoomControl: false
      })

      window.L.control.zoom({ position: 'bottomright' }).addTo(map)

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 20
      }).addTo(map)

      mapRef.current = map
    }

    const map = mapRef.current

    // Clear old markers
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    // Plot markers for each node
    nodes.forEach(node => {
      if (!node.latitude || !node.longitude) return

      const meta = aqiMeta(node.aqi || 0)

      // Custom HTML Badge marker with AQI value
      const icon = window.L.divIcon({
        className: 'custom-map-marker',
        html: `
          <div class="map-badge" style="color: ${meta.color}; border-color: ${meta.color}; box-shadow: 0 0 10px ${meta.color}30, inset 0 0 8px ${meta.color}20;">
            <span class="map-badge-val">${node.aqi || 0}</span>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      })

      const marker = window.L.marker([node.latitude, node.longitude], { icon })

      const popupHtml = `
        <div class="map-popup-card">
          <div class="map-popup-header">
            <h4>${node.location}</h4>
            <span class="map-popup-badge" style="color: ${meta.color}; background: ${meta.bg}">${meta.label}</span>
          </div>
          <div class="map-popup-aqi" style="color: ${meta.color}">${node.aqi || 0} <span class="map-popup-unit">AQI</span></div>
          <div class="map-popup-metrics">
            <div class="map-popup-metric"><span>PM2.5:</span> <strong>${node.pm25 ? node.pm25.toFixed(1) : '—'} µg/m³</strong></div>
            <div class="map-popup-metric"><span>PM10:</span> <strong>${node.pm10 ? node.pm10.toFixed(1) : '—'} µg/m³</strong></div>
            <div class="map-popup-metric"><span>NO2:</span> <strong>${node.no2 ? node.no2.toFixed(1) : '—'} µg/m³</strong></div>
          </div>
        </div>
      `

      marker.bindPopup(popupHtml, {
        closeButton: false,
        className: 'leaflet-custom-popup',
        offset: [0, -10]
      })

      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [nodes, loading])

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [])

  const handleNodeClick = (node) => {
    if (mapRef.current && node.latitude && node.longitude) {
      mapRef.current.setView([node.latitude, node.longitude], 14, { animate: true, duration: 0.8 })
      
      const marker = markersRef.current.find(m => {
        const latLng = m.getLatLng()
        return Math.abs(latLng.lat - node.latitude) < 0.0001 && Math.abs(latLng.lng - node.longitude) < 0.0001
      })
      
      if (marker) {
        marker.openPopup()
      }
    }
  }

  function clusterFor(node_id) {
    return clusters.find(c => c.node_ids?.includes(node_id))
  }

  const cityAvg = nodes.length ? Math.round(nodes.reduce((s, n) => s + (n.aqi || 0), 0) / nodes.length) : 0
  const worst   = nodes[0]
  const best    = nodes[nodes.length - 1]

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <MapPin size={22} className="text-brandCyan" /> Pollution Hotspots
          </h1>
          <p className="text-white/40 text-sm mt-1">All Chennai monitoring nodes ranked by AQI · auto-updates every 30s</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 glass-card text-white/60 hover:text-white text-sm rounded-btn transition-all">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && !nodes.length ? (
        <div className="flex items-center justify-center h-40 text-white/30">Loading nodes…</div>
      ) : (
        <>
          {/* City summary */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'City Average AQI', value: cityAvg, meta: aqiMeta(cityAvg) },
              { label: 'Worst Node',       value: worst?.aqi || 0, sub: worst?.location, meta: aqiMeta(worst?.aqi || 0), icon: <TrendingUp size={14}/> },
              { label: 'Best Node',        value: best?.aqi  || 0, sub: best?.location,  meta: aqiMeta(best?.aqi  || 0), icon: <TrendingDown size={14}/> },
            ].map(({ label, value, sub, meta, icon }) => (
              <div key={label} className="glass-card p-5 text-center">
                <p className="text-xs text-white/40 uppercase tracking-wide mb-2">{label}</p>
                <div className="text-4xl font-black mb-1" style={{ color: meta.color }}>{value}</div>
                <div className="text-xs font-semibold" style={{ color: meta.color }}>{meta.label}</div>
                {sub && <p className="text-xs text-white/30 mt-1 truncate">{sub}</p>}
              </div>
            ))}
          </div>

          {/* Interactive Map */}
          <div className="glass-card p-4 relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs text-white/40 uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-brandCyan animate-ping" />
                Live Spatial AQI Map
              </h3>
              <span className="text-[10px] text-white/30 font-medium">💡 Tip: Click list cards below to auto-zoom map to node</span>
            </div>
            <div id="hotspot-map" className="w-full h-80 rounded-[12px] bg-slate-950 border border-white/5 relative z-10" />
          </div>

          {/* Node list */}
          <div className="space-y-3">
            {nodes.map((node, i) => {
              const meta    = aqiMeta(node.aqi || 0)
              const isUser  = node.node_id === profile.node_id
              const cluster = clusterFor(node.node_id)
              const pct     = Math.min((node.aqi || 0) / 500 * 100, 100)

              return (
                <div
                  key={node.node_id}
                  onClick={() => handleNodeClick(node)}
                  className={`glass-card p-5 flex items-center gap-4 cursor-pointer hover:border-brandCyan/40 active:scale-[0.99] transition-all duration-300 ${isUser ? 'border-brandCyan/30' : ''}`}
                  style={isUser ? { borderColor: 'rgba(0,162,255,0.3)' } : {}}
                >
                  {/* Rank */}
                  <div className="w-9 h-9 rounded-btn flex items-center justify-center text-sm font-black text-white flex-shrink-0"
                    style={{ background: meta.color + '30', color: meta.color }}>
                    #{i + 1}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-bold text-white">{node.location}</span>
                      {isUser && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brandCyan/20 text-brandCyan border border-brandCyan/30">Your location</span>}
                      {cluster && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">{cluster.label}</span>}
                    </div>
                    <p className="text-xs text-white/40 mb-2">{node.district}, {node.state}</p>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: meta.color }} />
                    </div>
                    <div className="flex gap-4 mt-2">
                      {[['PM2.5', node.pm25], ['PM10', node.pm10], ['NO2', node.no2]].map(([l, v]) => (
                        <span key={l} className="text-[11px] text-white/40"><span className="text-white/60 font-semibold">{l}</span> {v ? v.toFixed(0) : '—'}</span>
                      ))}
                    </div>
                  </div>

                  {/* AQI */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-3xl font-black" style={{ color: meta.color }}>{node.aqi || 0}</div>
                    <div className="text-xs font-semibold mt-0.5" style={{ color: meta.color }}>{meta.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
