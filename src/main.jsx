import './boot-error-overlay.js'   // optional but useful
import './index.css'
import React from 'react'
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

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
)
