import React, { useState } from 'react'
import useAppStore from '../state/useAppStore.js'
import { generateRoadmapWithOpenAI, localFallbackRoadmap } from '../services/aiClient.js'

export default function Planner(){
  const [topics, setTopics] = useState('')
  const [level, setLevel] = useState('beginner')
  const [weeks, setWeeks] = useState(6)
  const [loading, setLoading] = useState(false)
  const setNodeStatus = useAppStore(s => s.setNodeStatus)
  const setRoadmap = useAppStore(s => s.setRoadmap) // we’ll add this setter

  async function handleGenerate(){
    setLoading(true)
    try{
      let plan
      try {
        plan = await generateRoadmapWithOpenAI({ topics, level, weeks, model: useAppStore.getState().settings.assistantModel })
      } catch (e) {
        if (e.message === 'NO_KEY') {
          plan = localFallbackRoadmap(topics, level, weeks)
        } else {
          alert(`AI error, falling back: ${e.message}`)
          plan = localFallbackRoadmap(topics, level, weeks)
        }
      }

      // Normalize to our store format
      const items = (plan.items || []).map((it, i) => ({
        id: it.id || `n${i}`,
        title: it.title || `Item ${i+1}`,
        status: it.status || 'not-started',
        estHours: typeof it.estHours === 'number' ? it.estHours : 8,
        prereqs: Array.isArray(it.prereqs) ? it.prereqs : []
      }))

      if (!items.length) throw new Error('Empty plan')

      setRoadmap(items) // replace the store roadmap
      alert('Roadmap generated! Check Roadmap & Progress pages.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="stack">
      <h1>AI Planner</h1>
      <p className="muted">Tell the assistant what you want to learn. It will craft a roadmap you can track.</p>

      <label className="label">Topics (comma-separated)</label>
      <textarea
        className="input"
        style={{height:100}}
        placeholder="e.g., Computer Vision, Diffusion Models, PyTorch"
        value={topics}
        onChange={e => setTopics(e.target.value)}
      />

      <div className="row">
        <div>
          <label className="label">Level</label>
          <select className="input" value={level} onChange={e=>setLevel(e.target.value)}>
            <option>beginner</option>
            <option>intermediate</option>
            <option>advanced</option>
          </select>
        </div>
        <div>
          <label className="label">Weeks</label>
          <input className="input" type="number" min="2" max="52" value={weeks} onChange={e=>setWeeks(Number(e.target.value))}/>
        </div>
      </div>

      <button className="btn" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating…' : 'Generate Roadmap'}
      </button>
    </div>
  )
}
