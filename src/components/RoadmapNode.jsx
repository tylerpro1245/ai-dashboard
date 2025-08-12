import React, { useState, useMemo } from 'react'
import useAppStore from '../state/useAppStore.js'
import ChallengeModal from './ChallengeModal.jsx'

export default function RoadmapNode({ node }) {
  const [open, setOpen] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const ensure = useAppStore(s => s.ensureNodeDetails)
  const details = useAppStore(s => s.nodeDetails[node.id])
  const toggleTask = useAppStore(s => s.toggleNodeTask)
  const setNodeStatus = useAppStore(s => s.setNodeStatus)
  const fetchChallengeSpec = useAppStore(s => s.fetchChallengeSpec)

  const readOnly = node.status === 'done'

  const onToggle = async () => {
    if (!details) ensure(node.id)
    try { if (typeof fetchChallengeSpec === 'function') await fetchChallengeSpec(node.id) } catch {}
    setOpen(o => !o)
  }

  const allTasksDone = useMemo(() => (details?.tasks || []).every(t => t.done), [details])
  const challengePassed = !!details?.challenge?.passed
  const canMarkDone = allTasksDone && challengePassed

  const startChallenge = async () => {
    if (!details) ensure(node.id)
    setShowModal(true) // open immediately
    try { if (typeof fetchChallengeSpec === 'function') await fetchChallengeSpec(node.id) } catch {}
  }

  return (
    <li className="list-row" style={{ alignItems: 'stretch', flexDirection: 'column', opacity: readOnly ? 0.85 : 1 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{node.title || 'Untitled topic'}</strong>
          <div className="muted">
            {(node.estHours ?? 8)}h • {node.id || 'no-id'}
            {readOnly && node.completedAt ? ` • Completed ${new Date(node.completedAt).toLocaleDateString()}` : null}
          </div>
        </div>
        <div className="row">
          <select
            value={node.status}
            disabled={readOnly}
            onChange={e => setNodeStatus(node.id, e.target.value)}
          >
            <option value="not-started">Not started</option>
            <option value="in-progress">In progress</option>
            <option value="done">Done (gated)</option>
          </select>
          <button className="btn" type="button" onClick={onToggle} style={{ marginLeft: 8 }}>
            {open ? 'Hide' : 'Open'}
          </button>
        </div>
      </div>

      {open && (
        <div className="card" style={{ marginTop: 12 }}>
          {/* Resources */}
          <h4 style={{ marginTop: 0 }}>Resources</h4>
          <ul>
            {(details?.resources || []).map(r => (
              <li key={r.id} style={{ marginBottom: 6 }}>
                <span className="muted">[{r.kind}]</span>{' '}
                <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a>
              </li>
            ))}
            {(!details || (details.resources || []).length === 0) && <li className="muted">No resources yet.</li>}
          </ul>

          {/* Tasks */}
          <h4>Tasks</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {(details?.tasks || []).map(t => (
              <li key={t.id} style={{ marginBottom: 6 }}>
                <label>
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={!!t.done}
                    onChange={() => toggleTask(node.id, t.id)}
                  />{' '}
                  {t.text}
                </label>
              </li>
            ))}
            {(!details || (details.tasks || []).length === 0) && <li className="muted">No tasks yet.</li>}
          </ul>

          {/* Challenge */}
          <h4>Challenge</h4>
          {/* Requirements are intentionally NOT shown here (modal only) */}
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn"
              type="button"
              onClick={startChallenge}
              disabled={readOnly || challengePassed}
              title={challengePassed ? 'Challenge already passed' : undefined}
            >
              {challengePassed ? 'Challenge Passed' : 'Open Challenge'}
            </button>
            <span className="muted">
              Requirements — Tasks: {allTasksDone ? '✅' : '❌'} • Challenge: {challengePassed ? '✅' : '❌'}
            </span>
          </div>

          {!canMarkDone && !readOnly && (
            <div className="muted" style={{ marginTop: 8 }}>
              Complete all tasks and pass the challenge to unlock <em>Done</em>.
            </div>
          )}
        </div>
      )}

      {showModal && <ChallengeModal node={node} onClose={() => setShowModal(false)} />}
    </li>
  )
}
