import React from 'react'
import { NavLink } from 'react-router-dom'

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">AI Dashboard</div>
      <nav>
        <NavLink to="/dashboard" className="nav" end>🏠 Dashboard</NavLink>
        <NavLink to="/roadmap" className="nav">🗺️ Roadmap</NavLink>
        <NavLink to="/planner" className="nav">🧭 Planner (AI)</NavLink>
        <NavLink to="/tasks" className="nav">✅ Tasks</NavLink>
        <NavLink to="/progress" className="nav">📈 Progress</NavLink>
        <NavLink to="/achievements" className="nav">🏆 Achievements</NavLink>
        <NavLink to="/settings" className="nav">⚙️ Settings</NavLink>
        <NavLink to="/account" className="nav">🔄 Account & Sync</NavLink> {/* NEW */}
      </nav>
    </aside>
  )
}
