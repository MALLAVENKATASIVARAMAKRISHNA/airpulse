import { Activity, Bell, BarChart2, Brain, Globe, Heart, LogOut, MapPin, Play, ShieldCheck, Settings, TrendingUp, Users, Wind, Zap } from 'lucide-react'
import Logo from './Logo'

const USER_NAV = [
  { id: 'overview',        icon: BarChart2,   label: 'Dashboard'     },
  { id: 'air',             icon: Wind,        label: 'Air Quality'   },
  { id: 'forecast',        icon: TrendingUp,  label: 'Forecast'      },
  { id: 'hotspot',         icon: MapPin,      label: 'Hotspots'      },
  { id: 'health',          icon: Heart,       label: 'Health Score'  },
  { id: 'recommendations', icon: ShieldCheck, label: 'Advice'        },
  { id: 'sources',         icon: Brain,       label: 'Sources'       },
  { id: 'alerts',          icon: Bell,        label: 'Alerts'        },
  { id: 'settings',        icon: Settings,    label: 'Settings'      },
]

const ADMIN_NAV = [
  { id: 'overview',   icon: BarChart2, label: 'Overview'   },
  { id: 'nodes',      icon: Globe,     label: 'Nodes'      },
  { id: 'users',      icon: Users,     label: 'Users'      },
  { id: 'simulation', icon: Play,      label: 'Simulation' },
  { id: 'anomalies',  icon: Zap,       label: 'Anomalies'  },
]

const AUTHORITY_NAV = [
  { id: 'overview',  icon: Globe,     label: 'City Overview' },
  { id: 'nodes',     icon: MapPin,    label: 'All Nodes'     },
  { id: 'anomalies', icon: Zap,       label: 'Anomalies'     },
  { id: 'alerts',    icon: Bell,      label: 'Alert Centre'  },
]

export default function AppShell({ role, onSignOut, activeTab, onTabChange, children }) {
  const nav = role === 'admin' ? ADMIN_NAV : role === 'authority' ? AUTHORITY_NAV : USER_NAV

  return (
    <div className="flex h-screen bg-darkBg text-white overflow-hidden">
      {/* Ambient glows */}
      <div className="mesh-glow-blue" />
      <div className="mesh-glow-green" />

      {/* Sidebar */}
      <aside className="relative z-10 flex flex-col w-60 h-full border-r border-white/[0.06] bg-white/[0.02] flex-shrink-0">
        <div className="px-5 py-6 border-b border-white/[0.06]">
          <Logo />
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {nav.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => onTabChange?.(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm font-medium transition-all duration-200 text-left
                ${activeTab === id
                  ? 'bg-brandBlue/20 text-brandCyan border border-brandBlue/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
            >
              <Icon size={17} />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 pb-5 space-y-2 border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="w-2 h-2 rounded-full bg-brandGreen animate-pulse" />
            <span className="text-xs text-white/40 font-medium">System live</span>
          </div>
          <div className="px-3 py-1.5">
            <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full border
              ${role === 'admin' ? 'text-orange-400 border-orange-400/30 bg-orange-400/10'
              : role === 'authority' ? 'text-purple-400 border-purple-400/30 bg-purple-400/10'
              : 'text-brandCyan border-brandCyan/30 bg-brandCyan/10'}`}>
              {role === 'admin' ? 'Admin' : role === 'authority' ? 'Authority' : 'Resident'}
            </span>
          </div>
          <button
            onClick={onSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-btn text-sm text-white/40 hover:text-white hover:bg-white/5 transition-all"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="relative z-10 flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
