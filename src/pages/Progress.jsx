import React from 'react'
import useAppStore from '../state/useAppStore.js'
import ProgressMap from '../components/ProgressMap.jsx'

export default function Progress() {
  const roadmap = useAppStore(s => s.roadmap)
  const total = roadmap.length
  const done = roadmap.filter(n => n.status === 'done').length
  const inprog = roadmap.filter(n => n.status === 'in-progress').length

  // nothing here can grant XP; store already enforces "award once"

  return (
    <div className="stack">
      <h1>Progress</h1>
      <p className="muted">{done}/{total} completed • {inprog} in progress</p>
      <ProgressMap />
    </div>
  )
}
