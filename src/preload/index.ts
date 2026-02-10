import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types/ipc-channels'
import type { DownloadProgress, GenerationProgress } from '../shared/types'

const electronAPI = {
  auth: {
    login: (creds?: { username: string; password: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, creds),
    logout: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGOUT),
    getSavedCredentials: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_SAVED),
    saveCredentials: (creds: { username: string; password: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_SAVE, creds),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.AUTH_STATUS)
  },

  prometeo: {
    fetchCatalog: (filter: { productType: string; category?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_FETCH_CATALOG, filter),
    fetchChartUrls: (productId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_FETCH_CHART_URLS, productId),
    fetchCatalogAndChartUrls: (filter: { productType: string }, productId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_FETCH_CATALOG_AND_CHART_URLS, filter, productId),
    fetchChartUrlsForPpt: (productType: string, productId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_FETCH_CHART_URLS_FOR_PPT, productType, productId),
    fetchImage: (imageUrl: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_FETCH_IMAGE, imageUrl),
    downloadCharts: (urls: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.PROMETEO_DOWNLOAD_CHARTS, urls),
    onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
      const handler = (_: Electron.IpcRendererEvent, progress: DownloadProgress) =>
        callback(progress)
      ipcRenderer.on(IPC_CHANNELS.PROMETEO_DOWNLOAD_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PROMETEO_DOWNLOAD_PROGRESS, handler)
    },
    onSessionExpired: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on(IPC_CHANNELS.PROMETEO_SESSION_EXPIRED, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PROMETEO_SESSION_EXPIRED, handler)
    }
  },

  template: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_LIST),
    load: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_LOAD, id),
    save: (template: unknown) => ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_SAVE, template),
    delete: (id: string) => ipcRenderer.invoke(IPC_CHANNELS.TEMPLATE_DELETE, id)
  },

  updater: {
    onStatus: (callback: (data: { status: string; version?: string; percent?: number; message?: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { status: string; version?: string; percent?: number; message?: string }) =>
        callback(data)
      ipcRenderer.on('updater:status', handler)
      return () => ipcRenderer.removeListener('updater:status', handler)
    },
    checkForUpdates: () => ipcRenderer.invoke('updater:check') as Promise<{ status: string; message?: string }>,
    downloadUpdate: () => ipcRenderer.invoke('updater:download') as Promise<{ ok: boolean; path?: string; error?: string }>,
    openFile: () => ipcRenderer.invoke('updater:open-file'),
    getVersion: () => ipcRenderer.invoke('updater:get-version') as Promise<string>
  },

  pptx: {
    generate: (definition: unknown) => ipcRenderer.invoke(IPC_CHANNELS.PPTX_GENERATE, definition),
    selectSavePath: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SELECT_SAVE_PATH),
    selectImage: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SELECT_IMAGE),
    selectPptx: () => ipcRenderer.invoke(IPC_CHANNELS.APP_SELECT_PPTX),
    readLocalImage: (filePath: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_READ_LOCAL_IMAGE, filePath) as Promise<string | null>,
    onProgress: (callback: (progress: GenerationProgress) => void) => {
      const handler = (_: Electron.IpcRendererEvent, progress: GenerationProgress) =>
        callback(progress)
      ipcRenderer.on(IPC_CHANNELS.PPTX_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.PPTX_PROGRESS, handler)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
