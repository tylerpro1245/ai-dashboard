import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import useAppStore, { levelFromXp, nextLevelXp, LEVEL_THRESHOLDS } from '../state/useAppStore.js'

const RANK_TITLES = [
  'Newcomer','Apprentice','Junior Tinkerer','Prompt Explorer',
  'Model Wrangler','AI Builder','Systems Thinker','Optimization Guru',
  'Research Adept','AI Specialist'
]

export default function Dashboard() {
  const roadmap = useAppStore(s => s.roadmap)
  const xp = useAppStore(s => s.xp) // <- subscribe to a primitive

  const info = useMemo(() => {
    const { currentLevel, cur, next } = nextLevelXp(xp)
    const title = RANK_TITLES[currentLevel - 1] ?? 'AI Specialist'
    const denom = Math.max(1, next - cur)
    const pct = Math.min(1, Math.max(0, (xp - cur) / denom))
    return { xp, level: currentLevel, title, cur, next, pct }
  }, [xp])

  const done = roadmap.filter(n => n.status === 'done').length

  return (
    <div className="stack">
      <h1>Welcome 👋</h1>
      <p className="muted">Rank: <strong>{info.title}</strong> • Level {info.level} • {info.xp} XP</p>

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span>Level Progress</span>
          <span>{Math.round(info.pct*100)}% ({info.xp - info.cur}/{info.next - info.cur} XP)</span>
        </div>
        <div style={{height:10, background:'var(--border)', borderRadius:999}}>
          <div style={{height:'100%', width:`${Math.min(100, info.pct*100)}%`, background:'var(--accent)', borderRadius:999}}/>
        </div>
      </div>

      <div className="grid">
        <div className="card">
          <h3>Today</h3>
          <p>Complete a task to earn XP and keep your streak alive.</p>
          <Link to="/tasks" className="btn">Go to Tasks</Link>
        </div>
        <div className="card">
          <h3>Roadmap</h3>
          <p>{done} / {roadmap.length} topics completed.</p>
          <Link to="/roadmap" className="btn">Open Roadmap</Link>
        </div>
        <div className="card">
          <h3>Achievements</h3>
          <p>Earn badges by leveling up and keeping streaks.</p>
          <Link to="/achievements" className="btn">View Achievements</Link>
        </div>
      </div>
    </div>
  )
}
