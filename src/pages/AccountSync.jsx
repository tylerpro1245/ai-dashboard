// src/pages/AccountSync.jsx
import React, { useEffect, useState, useCallback } from 'react'
import useAppStore from '../state/useAppStore.js'

export default function AccountSync() {
  // ✅ Select individually (no object selector)
  const signUp       = useAppStore(s => s.signUp)
  const signIn       = useAppStore(s => s.signIn)
  const signOut      = useAppStore(s => s.signOut)
  const getUser      = useAppStore(s => s.getUser)
  const syncPush     = useAppStore(s => s.syncPush)
  const syncPull     = useAppStore(s => s.syncPull)
  const exportState  = useAppStore(s => s.exportState)
  const importState  = useAppStore(s => s.importState)
  const lastSync     = useAppStore(s => s.lastSync)

  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [importText, setImportText] = useState('')

  const refreshUser = useCallback(async () => {
    try {
      const u = await getUser()
      // shallow compare to avoid unnecessary local state updates
      if ((u?.email || null) !== (user?.email || null)) setUser(u)
    } catch {/* ignore */}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getUser, user?.email])

  useEffect(() => { refreshUser() }, [refreshUser])

  const doSignUp = useCallback(async () => {
    if (!email || !password) return alert('Enter email & password')
    setBusy(true)
    try {
      await signUp(email, password)
      await refreshUser()
      alert('Signed up. If email confirmation is enabled, check your inbox.')
    } catch (e) {
      alert(e.message || String(e))
    } finally { setBusy(false) }
  }, [email, password, signUp, refreshUser])

  const doSignIn = useCallback(async () => {
    if (!email || !password) return alert('Enter email & password')
    setBusy(true)
    try {
      await signIn(email, password)
      await refreshUser()
    } catch (e) {
      alert(e.message || String(e))
    } finally { setBusy(false) }
  }, [email, password, signIn, refreshUser])

  const doSignOut = useCallback(async () => {
    setBusy(true)
    try {
      await signOut()
      setUser(null)
    } catch (e) {
      alert(e.message || String(e))
    } finally { setBusy(false) }
  }, [signOut])

  const pushNow = useCallback(async () => {
    setBusy(true)
    try {
      const { version } = await syncPush()
      alert(`Pushed OK (v${version})`)
    } catch (e) {
      alert(e.message || String(e))
    } finally { setBusy(false) }
  }, [syncPush])

  const pullNow = useCallback(async () => {
    setBusy(true)
    try {
      const r = await syncPull()
      if (r.imported) alert(`Pulled v${r.version}`)
      else alert('No server doc yet. Try Push to create it.')
    } catch (e) {
      alert(e.message || String(e))
    } finally { setBusy(false) }
  }, [syncPull])

  const doExport = useCallback(() => {
    const doc = exportState()
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ai-dashboard-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportState])

  const doImport = useCallback(() => {
    try {
      const obj = JSON.parse(importText)
      const ok = importState(obj)
      alert(ok ? 'Imported.' : 'Import failed.')
    } catch {
      alert('Invalid JSON')
    }
  }, [importText, importState])

  return (
    <div className="stack">
      <h1>Account & Sync</h1>

      {user ? (
        <>
          <div className="card">
            <div><strong>Signed in:</strong> {user.email}</div>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn" onClick={pullNow} disabled={busy}>Pull Latest</button>
              <button className="btn" onClick={pushNow} disabled={busy} style={{ marginLeft: 8 }}>Push Now</button>
              <button className="btn" onClick={doSignOut} disabled={busy} style={{ marginLeft: 8, background:'#374151' }}>Sign out</button>
            </div>
            {!!lastSync && (
              <p className="muted" style={{ marginTop: 8 }}>
                Version: {lastSync.version ?? '—'} • Last pull: {lastSync.lastPullAt ? new Date(lastSync.lastPullAt).toLocaleString() : '—'} • Last push: {lastSync.lastPushAt ? new Date(lastSync.lastPushAt).toLocaleString() : '—'}
              </p>
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginTop: 0 }}>Manual Backup</h3>
            <div className="row">
              <button className="btn" onClick={doExport}>Export JSON</button>
            </div>
            <textarea
              className="input"
              placeholder="Paste JSON here to import"
              value={importText}
              onChange={e => setImportText(e.target.value)}
              style={{ marginTop: 8, height: 140 }}
            />
            <div className="row" style={{ justifyContent:'flex-end' }}>
              <button className="btn" onClick={doImport}>Import</button>
            </div>
          </div>
        </>
      ) : (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sign in</h3>
          <input className="input" placeholder="email@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="input" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} style={{ marginTop: 8 }} />
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn" onClick={doSignIn} disabled={busy}>Sign in</button>
            <button className="btn" onClick={doSignUp} disabled={busy} style={{ marginLeft: 8 }}>Sign up</button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            Tip: You can export a backup JSON any time. API keys are not synced.
          </p>
        </div>
      )}
    </div>
  )
}
