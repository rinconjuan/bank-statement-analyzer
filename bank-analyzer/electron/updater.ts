import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'

export type UpdaterState = 'idle' | 'checking' | 'available' | 'not-available' | 'downloaded' | 'error'

export interface UpdaterStatus {
  state: UpdaterState
  version?: string
  note?: string
}

function sendStatus(window: BrowserWindow, status: UpdaterStatus): void {
  if (!window.isDestroyed()) {
    window.webContents.send('updater:status', status)
  }
}

export function setupAutoUpdater(window: BrowserWindow): void {
  // Avoid updater behavior in development mode.
  if (!app.isPackaged) {
    sendStatus(window, { state: 'idle', note: 'Updater disabled in development mode' })
    return
  }

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    sendStatus(window, { state: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    sendStatus(window, { state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    sendStatus(window, { state: 'not-available' })
  })

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus(window, { state: 'downloaded', version: info.version })
  })

  autoUpdater.on('error', (err) => {
    sendStatus(window, { state: 'error', note: err?.message || 'Unknown update error' })
  })

  ipcMain.removeHandler('updater:install')
  ipcMain.handle('updater:install', () => {
    autoUpdater.quitAndInstall()
  })

  // Run a first check shortly after startup and then periodically.
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      sendStatus(window, { state: 'error', note: message })
    })
  }, 8000)

  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {
      // Keep interval resilient; errors are already surfaced via event handlers.
    })
  }, 6 * 60 * 60 * 1000)
}
