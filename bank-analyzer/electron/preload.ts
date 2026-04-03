import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  getApiPort: () => ipcRenderer.invoke('get:apiPort'),
  installUpdate: () => ipcRenderer.invoke('updater:install'),
  onUpdaterStatus: (cb: (status: { state: string; version?: string; note?: string }) => void) => {
    const handler = (_: unknown, status: { state: string; version?: string; note?: string }) => cb(status)
    ipcRenderer.on('updater:status', handler)
    return () => ipcRenderer.removeListener('updater:status', handler)
  },
})

// API_PORT will be set via executeJavaScript from main process
