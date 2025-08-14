import './boot-error-overlay.js'   // optional but useful
import './index.css'
import React, { useEffect } from 'react'
import useAppStore from './state/useAppStore.js'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { attachConsole, info } from '@tauri-apps/plugin-log';

(async () => {
  try { await attachConsole(); } catch {}
  info('Frontend booted');
})();

// Catch uncaught errors and send them to the Tauri log too
window.addEventListener('error', (e) => {
  console.error('Uncaught:', e?.error || e?.message);
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('UnhandledRejection:', e?.reason);
});

function Boot() {
  useEffect(() => {
    const unsub = useAppStore.subscribe(
      (s) => s.settings?.appearance,
      (ap) => {
        const root = document.documentElement
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
        const theme = ap?.theme || 'system'
        const isLight = theme === 'system' ? !prefersDark : theme === 'light'
        root.classList.toggle('light', isLight)
        root.dataset.density = ap?.density || 'comfortable'
        root.dataset.accent = ap?.accent || 'blue'
      },
      { fireImmediately: true }
    )
    return () => unsub()
  }, [])

  return (
    <HashRouter>
      <App />
    </HashRouter>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><Boot /></React.StrictMode>
)
