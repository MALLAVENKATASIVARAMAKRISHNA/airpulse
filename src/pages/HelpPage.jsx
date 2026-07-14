import { HelpCircle, Shield, Info, BookOpen, Layers, Heart, CheckCircle2 } from 'lucide-react'

const AQI_RANGES = [
  { range: '0 - 50',   label: 'Good',         color: '#00E400', desc: 'Minimal health risk. Perfect for outdoor exercises and activities.' },
  { range: '51 - 100',  label: 'Satisfactory', color: '#76C442', desc: 'Satisfactory air quality; minor breathing discomfort for highly sensitive people.' },
  { range: '101 - 200', label: 'Moderate',     color: '#FFFF00', desc: 'Sensitive groups (asthma/COPD) may feel minor irritation. General public is mostly unaffected.' },
  { range: '201 - 300', label: 'Poor',         color: '#FF7E00', desc: 'Breathing discomfort to most people on prolonged exposure. Limit intense outdoor activity.' },
  { range: '301 - 400', label: 'Very Poor',    color: '#FF0000', desc: 'Respiratory illness on prolonged exposure. Avoid going outdoors; wear N95 mask if necessary.' },
  { range: '401 - 500', label: 'Severe',       color: '#8F3F97', desc: 'Healthy people experience breathing issues; severe impacts on people with heart/lung disease.' }
]

const POLLUTANTS = [
  { name: 'PM2.5', limit: '60 µg/m³', desc: 'Fine particulate matter (<2.5 µm). Can penetrate deep into lungs and bloodstream. Main sources: vehicle exhaust, burning fuel.' },
  { name: 'PM10',  limit: '100 µg/m³', desc: 'Coarse particulate matter (<10 µm). Can cause nasal and respiratory tract irritation. Main sources: road dust, construction dust.' },
  { name: 'NO2',   limit: '80 µg/m³', desc: 'Nitrogen Dioxide. Highly reactive gas causing lung inflammation. Main sources: motor vehicle emissions and power plants.' },
  { name: 'CO',    limit: '4 mg/m³', desc: 'Carbon Monoxide. Odorless gas that reduces oxygen delivery in the blood. Main sources: incomplete combustion in traffic.' },
  { name: 'Ozone', limit: '100 µg/m³', desc: 'Ground-level Ozone. Formed by sunlight reacting with hydrocarbons and NOx. Causes throat irritation and chest tightness.' },
  { name: 'NH3',   limit: '400 µg/m³', desc: 'Ammonia. Alkaline gas causing throat irritation. Main sources: agricultural runoffs and industrial chemical processes.' }
]

const GRAP_STEPS = [
  { stage: 'Stage I (Moderate-Poor: AQI 201-300)', actions: ['Enforce dust control at construction sites.', 'Regular mechanised sweeping of roads.', 'Strict actions against garbage burning.'] },
  { stage: 'Stage II (Very Poor: AQI 301-400)', actions: ['Ban usage of coal/firewood in eateries and open spaces.', 'Sprinkle water on roads to suppress suspended dust.', 'Enhance parking fees to discourage private vehicles.'] },
  { stage: 'Stage III (Severe: AQI 401-450)', actions: ['Ban non-essential construction and demolition activities.', 'Reroute or ban heavy diesel trucks from entering city limits.', 'Enforce work-from-home or online school classes if conditions persist.'] },
  { stage: 'Stage IV (Severe+: AQI > 450)', actions: ['Stop entry of commercial trucks except essential goods.', 'Implement odd-even traffic schemes.', 'Consider shutting down non-essential manufacturing plants.'] }
]

export default function HelpPage({ role }) {
  const isAuth = role === 'authority'

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 overflow-y-auto h-full pb-20">
      {/* Title */}
      <div className="flex items-center gap-3">
        <HelpCircle size={28} className="text-brandCyan" />
        <div>
          <h1 className="text-2xl font-black text-white">Help & Information Center</h1>
          <p className="text-xs text-white/40 mt-1">Learn how to read calculations, pollutant metrics, and system advice.</p>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* AQI Panel */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Layers size={18} className="text-brandCyan" />
            AQI Breakdowns
          </h2>
          <div className="space-y-3">
            {AQI_RANGES.map((item) => (
              <div key={item.label} className="p-3 rounded-btn border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.02] transition-colors flex gap-4">
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: item.color }} />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">{item.label}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/5 text-white/60">{item.range}</span>
                  </div>
                  <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pollutants Panel */}
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <BookOpen size={18} className="text-brandCyan" />
            Major Air Pollutants
          </h2>
          <div className="space-y-3">
            {POLLUTANTS.map((item) => (
              <div key={item.name} className="p-3 rounded-btn border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-black text-white">{item.name}</span>
                  <span className="text-[10px] font-bold text-brandCyan bg-brandCyan/10 px-2 py-0.5 rounded-full">
                    Safe Limit: {item.limit}
                  </span>
                </div>
                <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Role Specific Section */}
      {isAuth ? (
        <div className="glass-card p-6 space-y-4 border-brandCyan/20">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Shield size={18} className="text-brandCyan" />
            Graded Response Action Plan (GRAP)
          </h2>
          <p className="text-xs text-white/40 leading-relaxed">
            As a city authority, you are mandated to execute specific measures based on the regional Air Quality Index (AQI) values to combat pollution build-up.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
            {GRAP_STEPS.map((step) => (
              <div key={step.stage} className="p-4 rounded-btn border border-white/[0.03] bg-white/[0.02] space-y-2.5">
                <h3 className="text-xs font-black text-brandCyan uppercase tracking-wider">{step.stage}</h3>
                <ul className="space-y-1.5">
                  {step.actions.map((act, i) => (
                    <li key={i} className="text-xs text-white/50 flex gap-2">
                      <span className="text-brandCyan">▸</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="glass-card p-6 space-y-4">
          <h2 className="text-lg font-black text-white flex items-center gap-2">
            <Heart size={18} className="text-brandCyan" />
            How Warnings & Safety Levels Work
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-btn border border-white/[0.03] bg-white/[0.01] space-y-2">
              <div className="w-8 h-8 rounded-full bg-brandCyan/10 flex items-center justify-center">
                <Info size={16} className="text-brandCyan" />
              </div>
              <h3 className="text-sm font-bold text-white">1. Configure Profile</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Add health configurations (like Asthma or COPD), severity, and age in your settings.
              </p>
            </div>
            <div className="p-4 rounded-btn border border-white/[0.03] bg-white/[0.01] space-y-2">
              <div className="w-8 h-8 rounded-full bg-brandCyan/10 flex items-center justify-center">
                <Layers size={16} className="text-brandCyan" />
              </div>
              <h3 className="text-sm font-bold text-white">2. Thresholds Apply</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                Our system applies tailored AQI thresholds. An infant with asthma alerts at AQI 100.
              </p>
            </div>
            <div className="p-4 rounded-btn border border-white/[0.03] bg-white/[0.01] space-y-2">
              <div className="w-8 h-8 rounded-full bg-brandCyan/10 flex items-center justify-center">
                <CheckCircle2 size={16} className="text-brandCyan" />
              </div>
              <h3 className="text-sm font-bold text-white">3. Get Warned</h3>
              <p className="text-xs text-white/40 leading-relaxed">
                When the AQI reaches your personalized limit, a danger overlay is triggered to safeguard you.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* AI Anomaly details */}
      <div className="glass-card p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="w-12 h-12 rounded-full bg-brandGreen/10 flex-shrink-0 flex items-center justify-center">
          <Shield size={22} className="text-brandGreen" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-white">Predictive AI & Anomaly Detection</h3>
          <p className="text-xs text-white/40 leading-relaxed">
            The forecasts and warning triggers utilize our deployed Gradient Boosting ML models. If a sensor reports high readings due to local malfunctions or tampering, the system's Isolation Forest anomaly model detects the discrepancy, labels it, and triggers a forewarning badge.
          </p>
        </div>
      </div>
    </div>
  )
}
