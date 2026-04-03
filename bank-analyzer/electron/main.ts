import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import * as http from 'http'
import { PythonBridge } from './python-bridge'
import { registerIpcHandlers } from './ipc-handlers'
import { setupAutoUpdater } from './updater'

let mainWindow: BrowserWindow | null = null
let pythonBridge: PythonBridge | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

/** Poll /health until the backend responds 200 or we time out. */
function waitForHealth(port: number, maxWait = 15000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      if (Date.now() - start > maxWait) {
        reject(new Error(`Backend health check timed out after ${maxWait}ms`))
        return
      }
      const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
        if (res.statusCode === 200) {
          res.resume()
          resolve()
        } else {
          res.resume()
          setTimeout(check, 300)
        }
      })
      req.on('error', () => setTimeout(check, 300))
      req.end()
    }
    check()
  })
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    show: false,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0d0f14',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Launch Python backend
  pythonBridge = new PythonBridge()
  let port: number

  try {
    // Pass userData so the DB is stored in a persistent location that survives
    // app updates and reinstalls (e.g. %APPDATA%/Bank Analyzer/ on Windows).
    port = await pythonBridge.start(app.getPath('userData'))
    await waitForHealth(port)
    console.log(`Python backend ready on port ${port}`)
  } catch (err) {
    console.error('Failed to start Python backend:', err)
    // Show a user-friendly dialog instead of an uncaught-exception crash.
    // Note: the Electron main process has no access to the React i18n context,
    // so the message is shown in both supported languages (ES / EN).
    dialog.showErrorBox(
      'Error al iniciar el backend / Backend startup error',
      `No se pudo iniciar el servicio de backend.\n` +
      `Could not start the backend service.\n\n` +
      `${err instanceof Error ? err.message : String(err)}\n\n` +
      `Por favor reinstale la aplicación.\n` +
      `Please reinstall the application.`
    )
    app.quit()
    return
  }

  // Expose port globally so the IPC 'get:apiPort' handler can read it.
  ;(global as unknown as Record<string, unknown>).API_PORT = port

  // Also inject into renderer on every navigation as a fallback.
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.executeJavaScript(
      `window.API_PORT = ${port};`
    )
  })

  // Register IPC handlers BEFORE loading the URL so they are available
  // when the renderer calls getApiPort() during its bootstrap phase.
  registerIpcHandlers(mainWindow)

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  setupAutoUpdater(mainWindow)

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.on('before-quit', () => {
  pythonBridge?.stop()
})

// Extra safety net: ensure the backend is stopped even when the OS terminates
// the app directly (e.g. via the NSIS installer during an update).
app.on('will-quit', () => {
  pythonBridge?.stop()
})

// Synchronous last-resort cleanup: Node's 'exit' event fires even on abrupt
// termination and only allows synchronous code — stop() uses execSync on
// Windows so this works correctly.
process.on('exit', () => {
  pythonBridge?.stop()
})
