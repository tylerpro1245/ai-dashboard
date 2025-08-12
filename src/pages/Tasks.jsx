// src/pages/Tasks.jsx
import React, { useState } from 'react'
import useAppStore from '../state/useAppStore.js'

export default function Tasks() {
  const [title, setTitle] = useState('')
  const addTask = useAppStore(s => s.addTask)
  const tasks = useAppStore(s => s.tasks)
  const toggleTask = useAppStore(s => s.toggleTask)
  const clearDone = useAppStore(s => s.clearDone)
  const roadmap = useAppStore(s => s.roadmap)
  const streak = useAppStore(s => s.streak)
  const completeTask = useAppStore(s => s.completeTask)

  // Fake challenge generator — picks a random roadmap item
  const generateChallenge = () => {
    const incomplete = roadmap.filter(r => r.status !== 'done')
    if (incomplete.length === 0) return alert('All roadmap items done!')
    const pick = incomplete[Math.floor(Math.random() * incomplete.length)]
    addTask(`Complete 30 mins of "${pick.title}"`, pick.id)
  }

  const handleAdd = (e) => {
    e.preventDefault()
    if (!title.trim()) return
    addTask(title)
    setTitle('')
  }

  return (
    <div className="stack">
      <h1>Tasks</h1>
      <p className="muted">Daily streak: {streak} 🔥</p>

      <form onSubmit={handleAdd} className="row">
        <input
          className="input"
          placeholder="New task..."
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <button className="btn" type="submit">Add</button>
        <button type="button" className="btn" onClick={generateChallenge}>
          🎯 Daily Challenge
        </button>
      </form>

      <ul className="list">
        {tasks.length === 0 && <p className="muted">No tasks yet.</p>}
        {tasks.map(t => (
          <li key={t.id} className="list-row">
            <label style={{ flex: 1 }}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => {
                  toggleTask(t.id)
                  if (!t.done) completeTask(t.id)
                }}
              />{' '}
              {t.title}
              {t.relatedNodeId && (
                <span className="muted"> — {roadmap.find(r => r.id === t.relatedNodeId)?.title}</span>
              )}
            </label>
          </li>
        ))}
      </ul>

      {tasks.some(t => t.done) && (
        <button onClick={clearDone} className="btn">Clear completed</button>
      )}
    </div>
  )
}
