// src/App.jsx
import { enabled as supaEnabled } from './lib/supabase.js'
import React, { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar.jsx'
import Header from './components/Header.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Roadmap from './pages/Roadmap.jsx'
import Tasks from './pages/Tasks.jsx'
import Progress from './pages/Progress.jsx'
import Achievements from './pages/Achievements.jsx'
import Settings from './pages/Settings.jsx'
import Planner from './pages/Planner.jsx'
import AccountSync from './pages/AccountSync.jsx'
import useAppStore from './state/useAppStore.js'

function debounce(fn, wait){
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export default function App() {
  // safe default so we never render without a theme class
  const theme = useAppStore(s => s.theme || 'dark')

  // pull on start; set online/offline status
  const syncPull = useAppStore(s => s.syncPull)
  const syncPush = useAppStore(s => s.syncPush)
  const getUser  = useAppStore(s => s.getUser)
  const autoSync = useAppStore(s => s.autoSync)
  const setSyncStatus = useAppStore(s => s.setSyncStatus)

  // 1) Pull on start + online/offline badge + refocus pull
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const u = await getUser()
        if (mounted && u && autoSync) {
          await syncPull()
        }
        if (!supaEnabled) {
  setSyncStatus && setSyncStatus('disabled') // optional UI hint
  return // don’t call syncPull/syncPush
}
      } catch {}
    })()

    const onOnline  = () => setSyncStatus('synced')
    const onOffline = () => setSyncStatus('offline')
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    const onFocus = async () => {
      try {
        const u = await getUser()
        if (u && autoSync) await syncPull()
      } catch {}
    }
    const onVis = () => { if (document.visibilityState === 'visible') onFocus() }
    window.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', onFocus)

    return () => {
      mounted = false
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [getUser, syncPull, autoSync, setSyncStatus])

  // 2) Debounced push on store changes
  const debouncedPushRef = useRef(null)
  if (!debouncedPushRef.current) {
    debouncedPushRef.current = debounce(async () => {
      try {
        const u = await getUser()
        if (!autoSync || !u) {
          setSyncStatus('idle')
          return
        }
        setSyncStatus('pushing')
        await syncPush()
        setSyncStatus('synced')
      } catch {
        setSyncStatus(navigator.onLine ? 'error' : 'offline')
      }
    }, 800)
  }

  // 3) Subscribe to store changes + poll server version every 10s
  useEffect(() => {
    const pick = (s) => ({
      roadmap: s.roadmap,
      nodeDetails: s.nodeDetails,
      tasks: s.tasks,
      xp: s.xp,
      achievements: s.achievements,
      settings: s.settings,
      streak: s.streak,
      lastCompleted: s.lastCompleted,
    })

    let prev = pick(useAppStore.getState())
    const unsub = useAppStore.subscribe(
      (state) => pick(state),
      async (next) => {
        const changed =
          next.roadmap !== prev.roadmap ||
          next.nodeDetails !== prev.nodeDetails ||
          next.tasks !== prev.tasks ||
          next.xp !== prev.xp ||
          next.achievements !== prev.achievements ||
          next.settings !== prev.settings ||
          next.streak !== prev.streak ||
          next.lastCompleted !== prev.lastCompleted

        if (changed) debouncedPushRef.current()
        prev = next
      }
    )

    const poll = setInterval(async () => {
      try {
        if (!autoSync) return
        const u = await getUser()
        if (!u) return

        // static import, no dynamic import needed
        const { data, error } = await supabase
          .from('profiles')
          .select('version, updated_at')
          .eq('user_id', u.id)
          .maybeSingle()
        if (error || !data) return

        const localVersion = useAppStore.getState().lastSync?.version ?? 0
        if (data.version > localVersion) {
          await syncPull()
        }
      } catch {}
    }, 10000)

    const onBeforeUnload = async () => {
      try {
        const u = await getUser()
        if (u && autoSync) {
          setSyncStatus('pushing')
          await syncPush()
          setSyncStatus('synced')
        }
      } catch {}
    }
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      unsub()
      clearInterval(poll)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [getUser, syncPush, syncPull, autoSync, setSyncStatus])

  return (
    <div className={`app ${theme}`}>
      <Sidebar />
      <div className="main">
        <Header />
        <div className="page">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/achievements" element={<Achievements />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/account" element={<AccountSync />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
