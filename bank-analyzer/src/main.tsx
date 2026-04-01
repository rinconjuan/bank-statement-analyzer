import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import './styles/globals.css'

async function bootstrap() {
  // Fetch the dynamic backend port from the Electron main process before
  // rendering. This ensures every API call uses the correct port regardless
  // of when React mounts or fires its first effects.
  if (window.electronAPI) {
    try {
      const port = await window.electronAPI.getApiPort()
      window.API_PORT = port
    } catch (_) {
      // Fall back to the env variable / default (8000); leave window.API_PORT unset.
    }
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ThemeProvider>
        <LanguageProvider>
          <App />
        </LanguageProvider>
      </ThemeProvider>
    </React.StrictMode>
  )
}

bootstrap()
