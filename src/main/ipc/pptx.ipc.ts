import { ipcMain, BrowserWindow, dialog } from 'electron'
import { readFileSync, existsSync } from 'fs'
import { IPC_CHANNELS } from '@shared/types'
import type { BriefingDefinition } from '@shared/types'
import { pptxService } from '../services/pptx.service'

export function registerPptxIpc(): void {
  ipcMain.handle(IPC_CHANNELS.PPTX_GENERATE, async (event, definition: BriefingDefinition) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    const outputPath = await pptxService.generate(definition, (progress) => {
      mainWindow?.webContents.send(IPC_CHANNELS.PPTX_PROGRESS, progress)
    })
    return { outputPath }
  })

  ipcMain.handle(IPC_CHANNELS.APP_SELECT_SAVE_PATH, async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) return null

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Salva Briefing',
      defaultPath: `briefing_${new Date().toISOString().split('T')[0]}.pptx`,
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }]
    })

    return result.canceled ? null : result.filePath
  })

  ipcMain.handle(IPC_CHANNELS.APP_SELECT_IMAGE, async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleziona immagine',
      filters: [{ name: 'Immagini', extensions: ['png', 'jpg', 'jpeg', 'bmp', 'gif'] }],
      properties: ['openFile']
    })

    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.APP_SELECT_PPTX, async (event) => {
    const mainWindow = BrowserWindow.fromWebContents(event.sender)
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleziona template PowerPoint',
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
      properties: ['openFile']
    })

    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  ipcMain.handle(IPC_CHANNELS.APP_READ_LOCAL_IMAGE, async (_event, filePath: string) => {
    try {
      if (!filePath || !existsSync(filePath)) return null
      const data = readFileSync(filePath)
      const ext = filePath.toLowerCase().endsWith('.png') ? 'png' : 'jpeg'
      return `data:image/${ext};base64,${data.toString('base64')}`
    } catch {
      return null
    }
  })
}
