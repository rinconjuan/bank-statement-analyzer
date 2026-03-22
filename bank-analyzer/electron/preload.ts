import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) =>
    ipcRenderer.invoke('dialog:saveFile', options),
  getApiPort: () => ipcRenderer.invoke('get:apiPort'),
})

// API_PORT will be set via executeJavaScript from main process
