import {
  Bell,
  Gauge,
  LogOut,
  MapPinned,
  Settings2,
  Users,
} from 'lucide-react'
import Logo from './Logo'

export default function AppShell({ role, title, subtitle, onSignOut, children }) {
  const admin = role === 'admin'

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <nav>
          <button className="nav-item active">
            <Gauge size={19} /> Overview
          </button>
          <button className="nav-item">
            <MapPinned size={19} /> {admin ? 'Monitoring nodes' : 'My location'}
          </button>
          <button className="nav-item">
            {admin ? <Users size={19} /> : <Bell size={19} />}
            {admin ? 'Users' : 'Alerts'}
          </button>
          <button className="nav-item">
            <Settings2 size={19} /> Settings
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="live-chip"><span /> System live</div>
          <button className="nav-item" onClick={onSignOut}>
            <LogOut size={19} /> Sign out
          </button>
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
