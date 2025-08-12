import React from 'react'
import useAppStore from '../state/useAppStore.js'

export default function Header() {
  const theme = useAppStore(s => s.theme || 'dark')
  const toggleTheme = useAppStore(s => s.toggleTheme)
  const syncStatus = useAppStore(s => s.syncStatus)
  const autoSync = useAppStore(s => s.autoSync)
  const setAutoSync = useAppStore(s => s.setAutoSync)

  const badgeColor = syncStatus === 'pushing' || syncStatus === 'pulling'
    ? '#f59e0b'
    : syncStatus === 'synced'
    ? '#22c55e'
    : syncStatus === 'offline'
    ? '#94a3b8'
    : syncStatus === 'error'
    ? '#ef4444'
    : '#94a3b8'

  return (
    <header className="header">
      <div className="row" style={{ gap: 12 }}>
        <span style={{ fontSize:12, padding:'4px 8px', borderRadius:8, background:'var(--card)', display:'inline-flex', alignItems:'center', gap:6 }}>
          <i style={{ width:8, height:8, borderRadius:999, background: badgeColor, display:'inline-block' }} />
          <span style={{ color:'var(--muted)' }}>{syncStatus}</span>
        </span>
        <label className="row" style={{ gap:6, fontSize:12, alignItems:'center' }}>
          <input type="checkbox" checked={!!autoSync} onChange={e=>setAutoSync(e.target.checked)} />
          Auto-sync
        </label>
      </div>
      <div className="header-actions">
        <button className="btn" onClick={toggleTheme}>
          {theme === 'dark' ? '🌞 Light' : '🌙 Dark'}
        </button>
      </div>
    </header>
  )
}
