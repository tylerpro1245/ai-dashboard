import React, { useMemo } from 'react'
import { Link } from 'react-router-dom'
import useAppStore, { nextLevelXp } from '../state/useAppStore.js'

const RANK_TITLES = [
  'Newcomer','Apprentice','Junior Tinkerer','Prompt Explorer',
  'Model Wrangler','AI Builder','Systems Thinker','Optimization Guru',
  'Research Adept','AI Specialist'
]

export default function Dashboard() {
  const roadmap = useAppStore(s => s.roadmap)
  const xp = useAppStore(s => s.xp)
  const tasks = useAppStore(s => s.tasks)

  const info = useMemo(() => {
    const { currentLevel, cur, next } = nextLevelXp(xp)
    const title = RANK_TITLES[currentLevel - 1] ?? 'AI Specialist'
    const denom = Math.max(1, next - cur)
    const pct = Math.min(1, Math.max(0, (xp - cur) / denom))
    return { xp, level: currentLevel, title, cur, next, pct }
  }, [xp])

  const todayDone = useMemo(() => {
    const today = new Date().toDateString()
    return tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === today)
  }, [tasks])


  const done = roadmap.filter(n => n.status === 'done').length

  return (
    <div className="stack">
      <h1>Welcome 👋</h1>
      <p className="muted">
        Rank: <strong>{info.title}</strong> • Level {info.level} • {info.xp} XP
      </p>

      <div className="card">
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          <span>Level Progress</span>
          <span>{Math.round(info.pct*100)}% ({info.xp - info.cur}/{info.next - info.cur} XP)</span>
        </div>
        <div style={{height:10, background:'var(--border)', borderRadius:999}}>
          <div style={{height:'100%', width:`${Math.min(100, info.pct*100)}%`, background:'var(--accent)', borderRadius:999}}/>
        </div>
      </div>

      {/* 3-up horizontal cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 12
        }}
      >
        <div className="card">
          <h3 style={{marginTop:0}}>Today</h3>
          <p className="muted">Complete a task to earn XP and keep your streak alive.</p>
          <Link to="/tasks" className="btn">Go to Tasks</Link>
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Roadmap</h3>
          <p className="muted">{done} / {roadmap.length} topics completed.</p>
          <Link to="/roadmap" className="btn">Open Roadmap</Link>
        </div>

        <div className="card">
          <h3 style={{marginTop:0}}>Achievements</h3>
          <p className="muted">Earn badges by leveling up and keeping streaks.</p>
          <Link to="/achievements" className="btn">View Achievements</Link>
        </div>
      </div>
    </div>
  )
}
