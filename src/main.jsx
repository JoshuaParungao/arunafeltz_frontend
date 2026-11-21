import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './app/App.jsx'
import { ThemeProvider } from './context/ThemeContext'

// Auto-reload when a new deployment invalidates cached chunks (Vite SPA deployment recovery)
window.addEventListener('vite:preloadError', () => {
  window.location.reload()
})

window.addEventListener('error', (e) => {
  if (e?.message && /Failed to fetch dynamically imported module/i.test(e.message)) {
    const lastReload = Number(sessionStorage.getItem('chunk_reload_ts') || 0)
    // Prevent infinite loop if network is truly down
    if (Date.now() - lastReload > 10000) {
      sessionStorage.setItem('chunk_reload_ts', String(Date.now()))
      window.location.reload()
    }
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

