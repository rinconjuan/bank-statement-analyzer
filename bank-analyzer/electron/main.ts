import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import * as path from 'path'
import { PythonBridge } from './python-bridge'
import { registerIpcHandlers } from './ipc-handlers'

let mainWindow: BrowserWindow | null = null
let pythonBridge: PythonBridge | null = null

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

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
    port = await pythonBridge.start()
    console.log(`Python backend running on port ${port}`)
  } catch (err) {
    console.error('Failed to start Python backend:', err)
    port = 8000
  }

  // Pass port to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.executeJavaScript(
      `window.API_PORT = ${port};`
    )
  })

  if (isDev) {
    await mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    await mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  registerIpcHandlers(mainWindow)
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
