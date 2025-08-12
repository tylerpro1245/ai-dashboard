// src/components/ChallengeModal.jsx
import React, { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { invoke } from '@tauri-apps/api/core'
import useAppStore from '../state/useAppStore.js'

export default function ChallengeModal({ node, onClose }) {
  const details = useAppStore(s => s.nodeDetails[node.id])
  const rubric = details?.challenge?.rubric
  const requirements = details?.challenge?.requirements || []
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const setChallengePassed = useAppStore(s => s.setChallengePassed)
  const model = useAppStore(s => s.settings?.assistantModel ?? 'gpt-4o-mini')

  // Close on Escape and on overlay click
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = useCallback(async () => {
    if (!answer.trim()) return alert('Please write your answer.')
    setLoading(true)
    try {
      const res = await invoke('submit_challenge', {
        payload: { node_id: node.id, title: node.title, answer, model, rubric }
      })
      const { passed, feedback } = res
      setChallengePassed(node.id, !!passed)
      alert(`${passed ? '✅ Passed' : '❌ Not passed'}\n\nFeedback:\n${feedback}`)
      onClose?.()
    } catch (e) {
      alert('Review failed: ' + e)
    } finally {
      setLoading(false)
    }
  }, [answer, model, node.id, node.title, rubric, onClose, setChallengePassed])

  const modal = (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 99999
      }}
    >
      <div className="card" style={{ width: 640, maxWidth: '92vw' }}>
        <h3 style={{ color: 'var(--text)', marginTop: 0 }}>Challenge — {node.title}</h3>

        {requirements.length > 0 ? (
          <ul className="muted" style={{ marginTop: 6, lineHeight: 1.4 }}>
            {requirements.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        ) : (
          <p className="muted" style={{ marginTop: 0 }}>
            Write your answer below and submit for AI review.
          </p>
        )}

        <textarea
          className="input"
          style={{ height: 180, width: '100%', marginTop: 8 }}
          value={answer}
          onChange={e => setAnswer(e.target.value)}
          placeholder="Explain the concept; include an example or short code where helpful."
        />

        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn" type="button" onClick={onClose} style={{ background: '#374151' }}>
            Cancel
          </button>
          <button className="btn" type="button" onClick={submit} disabled={loading} style={{ marginLeft: 8 }}>
            {loading ? 'Submitting…' : 'Submit for Review'}
          </button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
