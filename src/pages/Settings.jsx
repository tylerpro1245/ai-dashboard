import React, { useState, useEffect, useCallback } from 'react'
import useAppStore from '../state/useAppStore.js'
import { invoke } from '@tauri-apps/api/core'

export default function Settings() {
  const settings        = useAppStore(s => s.settings)
  const update          = useAppStore(s => s.updateSettings)

  // NEW: sync helpers
  const resetLocalState = useAppStore(s => s.resetLocalState)
  const resetEverywhere = useAppStore(s => s.resetEverywhere)
  const autoSync        = useAppStore(s => s.autoSync)
  const setAutoSync     = useAppStore(s => s.setAutoSync)

  // show a masked placeholder if saved before
  const [apiKey, setApiKey] = useState(localStorage.getItem('openai_api_key_masked') || '')

  useEffect(() => {
    // (optional) you could ask backend if a key exists and show a checkmark
  }, [])

  const saveKey = useCallback(async () => {
    const key = apiKey.trim()
    if (!key || !/^sk-/.test(key)) return alert('Please enter a valid OpenAI API key (starts with sk-).')
    try {
      await invoke('save_api_key', { key })
      localStorage.setItem('openai_api_key_masked', '•••••••••• (saved)')
      setApiKey('•••••••••• (saved)')
      alert('API key saved to the Tauri backend.')
    } catch (e) {
      console.error(e)
      alert('Failed to save key: ' + e)
    }
  }, [apiKey])

  const testBackend = useCallback(async () => {
    try {
      const pong = await invoke('ping')
      alert('Backend OK: ' + pong)
    } catch (e) {
      alert('Backend not reachable. Make sure the desktop shell is running.')
    }
  }, [])

  // NEW: clearly separated reset actions
  const doResetLocal = useCallback(() => {
    if (confirm('Reset LOCAL data only? (Cloud copy will return on next pull.)')) {
      resetLocalState()
      alert('Local data cleared. If Auto-sync is ON and you are signed in, a pull may restore cloud data on focus.')
    }
  }, [resetLocalState])

  const doResetEverywhere = useCallback(async () => {
    if (!confirm('Reset EVERYWHERE? This overwrites your cloud profile with an empty one. This cannot be undone.')) return
    try {
      await resetEverywhere()
      alert('Local + cloud data cleared.')
    } catch (e) {
      alert('Reset failed: ' + (e?.message || e))
    }
  }, [resetEverywhere])

  return (
    <div className="stack">
      <h1>Settings ⚙️</h1>

      {/* Sync controls */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Sync</h3>
        <label className="row" style={{ gap: 8, alignItems: 'center' }}>
          <input
            type="checkbox"
            checked={!!autoSync}
            onChange={e => setAutoSync(e.target.checked)}
          />
          Auto-sync changes across devices
        </label>
        <div className="row" style={{ marginTop: 12, gap: 8 }}>
          <button className="btn" onClick={doResetLocal} style={{ background: '#475569' }}>
            Reset Local Only
          </button>
          <button className="btn" onClick={doResetEverywhere} style={{ background: '#dc2626' }}>
            Reset Local + Cloud
          </button>
        </div>
      </div>

      <label className="label">OpenAI API Key (stored in backend)</label>
      <input
        className="input"
        type="password"
        placeholder="sk-..."
        value={apiKey}
        onChange={e => setApiKey(e.target.value)}
      />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn" onClick={saveKey}>Save API Key</button>
        <button className="btn" onClick={testBackend} style={{ background:'#374151' }}>Test Backend</button>
      </div>

      <label className="label" style={{ marginTop: 16 }}>Assistant model</label>
      <input
        className="input"
        value={settings.assistantModel}
        onChange={e => update({ assistantModel: e.target.value })}
      />
    </div>
  )
}
