import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import { authService, type Credentials } from '../services/auth.service'

export function registerAuthIpc(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH_LOGIN, async (_event, creds?: Credentials) => {
    return authService.login(creds)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_LOGOUT, async () => {
    await authService.logout()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_GET_SAVED, () => {
    return authService.getSavedCredentials()
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_SAVE, (_event, creds: Credentials) => {
    authService.saveCredentials(creds)
  })

  ipcMain.handle(IPC_CHANNELS.AUTH_STATUS, () => {
    return authService.getStatus()
  })
}
