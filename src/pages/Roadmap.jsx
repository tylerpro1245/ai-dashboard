import React from 'react'
import useAppStore from '../state/useAppStore.js'
import RoadmapNode from '../components/RoadmapNode.jsx'

export default function Roadmap() {
  const roadmap = useAppStore(s => s.roadmap)

  const active = roadmap.filter(n => n.status !== 'done')
  const completed = roadmap.filter(n => n.status === 'done')

  return (
    <div className="stack">
      <h1>Roadmap</h1>

      <h3 style={{ marginBottom: 6 }}>Active</h3>
      {active.length === 0 && <p className="muted">No active items.</p>}
      <ul className="list">
        {active.map(node => <RoadmapNode key={node.id} node={node} />)}
      </ul>

      <h3 style={{ marginTop: 20, marginBottom: 6 }}>Completed</h3>
      {completed.length === 0 && <p className="muted">Nothing completed yet.</p>}
      <ul className="list">
        {completed.map(node => <RoadmapNode key={node.id} node={node} />)}
      </ul>
    </div>
  )
}
