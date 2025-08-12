import React, { useMemo } from 'react'
import useAppStore, { nextLevelXp } from '../state/useAppStore.js'

const RANK_TITLES = [
  'Newcomer','Apprentice','Junior Tinkerer','Prompt Explorer',
  'Model Wrangler','AI Builder','Systems Thinker','Optimization Guru',
  'Research Adept','AI Specialist'
]

export default function Achievements() {
  // subscribe only to stable primitives
  const xp = useAppStore(s => s.xp)
  const achievements = useAppStore(s => s.achievements)

  const info = useMemo(() => {
    const { currentLevel, cur, next } = nextLevelXp(xp)
    const title = RANK_TITLES[currentLevel - 1] ?? 'AI Specialist'
    const denom = Math.max(1, next - cur)
    const pct = Math.min(1, Math.max(0, (xp - cur) / denom))
    return { xp, level: currentLevel, title, cur, next, pct }
  }, [xp])

  const list = useMemo(() => (achievements ?? []).slice().reverse(), [achievements])

  return (
    <div className="stack">
      <h1>Achievements 🏆</h1>
      <p className="muted">
        Current Rank: <strong>{info.title}</strong> — Level {info.level} — {info.xp} XP
      </p>

      {list.length === 0 && <p className="muted">No achievements yet — complete tasks and roadmap items!</p>}

      <ul className="list">
        {list.map(a => (
          <li key={a.id} className="list-row">
            <div>
              <strong>{a.title}</strong>
              <div className="muted">{a.detail}</div>
            </div>
            <div className="muted">{new Date(a.earnedAt).toLocaleString()}</div>
          </li>
        ))}
      </ul>
    </div>
  )
}
