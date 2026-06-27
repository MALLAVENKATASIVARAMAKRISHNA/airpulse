import { Activity, Gauge, LogOut, MapPinned, Play, Users, Wind } from 'lucide-react'
import Logo from './Logo'

const ADMIN_NAV = [
  { id: 'overview',    icon: Gauge,     label: 'Overview'    },
  { id: 'nodes',       icon: MapPinned, label: 'Nodes'       },
  { id: 'users',       icon: Users,     label: 'Users'       },
  { id: 'simulation',  icon: Play,      label: 'Simulation'  },
]

const USER_NAV = [
  { id: 'overview', icon: Gauge,    label: 'Dashboard' },
  { id: 'air',      icon: Wind,     label: 'Air quality' },
  { id: 'activity', icon: Activity, label: 'Activity'   },
]

export default function AppShell({ role, title, subtitle, onSignOut, activeTab, onTabChange, children }) {
  const admin = role === 'admin'
  const nav   = admin ? ADMIN_NAV : USER_NAV

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          {nav.map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              className={`nav-item ${activeTab === id ? 'active' : ''}`}
              onClick={() => onTabChange?.(id)}
            >
              <Icon size={19} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="live-chip"><span /> System live</div>
          <button className="nav-item" onClick={onSignOut}><LogOut size={19} /> Sign out</button>
        </div>
      </aside>

      <div className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">{admin ? 'Administration' : 'Live air intelligence'}</p>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <span className={`role-pill ${admin ? 'admin' : ''}`}>
            {admin ? 'Admin access' : 'Resident'}
          </span>
        </header>
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  )
}
