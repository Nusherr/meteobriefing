import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { BriefingTemplate } from '@shared/types'
import { templateService } from '../services/template.service'

export function registerTemplateIpc(): void {
  ipcMain.handle(IPC_CHANNELS.TEMPLATE_LIST, () => {
    return templateService.list()
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_LOAD, (_event, id: string) => {
    return templateService.load(id)
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_SAVE, (_event, template: BriefingTemplate) => {
    return templateService.save(template)
  })

  ipcMain.handle(IPC_CHANNELS.TEMPLATE_DELETE, (_event, id: string) => {
    templateService.delete(id)
  })
}
