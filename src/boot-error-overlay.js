// Loud errors for packaged build
window.addEventListener('error', (e) => {
  // eslint-disable-next-line no-console
  console.error('Global error:', e.error || e.message)
  alert('A runtime error occurred. Check logs (Help → Toggle DevTools or log file).')
})

window.addEventListener('unhandledrejection', (e) => {
  // eslint-disable-next-line no-console
  console.error('Unhandled promise rejection:', e.reason)
  alert('A promise error occurred. Check logs.')
})
