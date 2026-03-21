import { ipcMain, dialog, BrowserWindow } from 'electron'

export function registerIpcHandlers(window: BrowserWindow): void {
  ipcMain.handle('dialog:openFile', async () => {
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    })
    return result.canceled ? null : result.filePaths[0]
  })

  ipcMain.handle('dialog:saveFile', async (_, options: { defaultPath?: string; filters?: Array<{ name: string; extensions: string[] }> }) => {
    const result = await dialog.showSaveDialog(window, options)
    return result.canceled ? null : result.filePath
  })

  ipcMain.handle('get:apiPort', () => {
    return (global as unknown as Record<string, unknown>).API_PORT ?? 8000
  })
}
