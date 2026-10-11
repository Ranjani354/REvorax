import { useRcm } from '../context/RcmContext'
import '../App.css'

export default function PageShell({ title, subtitle, children }) {
  const {
    user, handleSignOut, handleNavigate, activeNav,
    loadClaims,
  } = useRcm()

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-block">
            <div className="brand-badge">R</div>
            <div>
              <p className="eyebrow">Revenue Operations</p>
              <h1>RevoraX</h1>
            </div>
          </div>
          <nav className="nav">
            <button className={`nav-item ${activeNav === 'dashboard' ? 'active' : ''}`} type="button" onClick={() => handleNavigate('dashboard')}>Dashboard</button>
            <button className={`nav-item ${activeNav === 'claims' ? 'active' : ''}`} type="button" onClick={() => { handleNavigate('claims'); loadClaims() }}>Claims</button>
            <button className={`nav-item ${activeNav === 'work-queue' ? 'active' : ''}`} type="button" onClick={() => handleNavigate('work-queue')}>Work Queues</button>
            <button className={`nav-item ${activeNav === 'denials' ? 'active' : ''}`} type="button" onClick={() => handleNavigate('denials')}>Denials</button>
            <button className={`nav-item ${activeNav === 'payments' ? 'active' : ''}`} type="button" onClick={() => handleNavigate('payments')}>Payments</button>
            <button className={`nav-item ${activeNav === 'assistant' ? 'active' : ''}`} type="button" onClick={() => handleNavigate('assistant')}>Assistant</button>
          </nav>
        </div>

        <div className="user-section">
          <div className="user-pill">
            <span className="avatar">U</span>
            <div>
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </div>
          </div>
          <button type="button" className="signout-button" onClick={handleSignOut}>Sign out</button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="topbar-space" />
          <div className="top-user">
            <span className="top-user-icon">○</span>
            <span>{user?.role === 'admin' ? 'AR Executive' : (user?.name || 'AR Executive User')}</span>
          </div>
        </header>
        <header className="content-header">
          <div>
            <h3>{title}</h3>
            <p>{subtitle}</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  )
}
