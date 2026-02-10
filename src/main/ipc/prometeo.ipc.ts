import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '@shared/types'
import type { PrometeoProductFilter } from '@shared/types'
import { prometeoService } from '../services/prometeo.service'
import { downloaderService } from '../services/downloader.service'

export function registerPrometeoIpc(): void {
  ipcMain.handle(
    IPC_CHANNELS.PROMETEO_FETCH_CATALOG,
    async (_event, filter: PrometeoProductFilter) => {
      try {
        const result = await prometeoService.fetchProductCatalog(filter)
        // Ensure result is a plain serializable object
        return JSON.parse(JSON.stringify(result))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[IPC] fetchCatalog error:', msg)
        return { products: [], categories: [], types: [], areas: [], error: msg }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROMETEO_FETCH_CATALOG_AND_CHART_URLS,
    async (_event, filter: PrometeoProductFilter, productId: string) => {
      try {
        const result = await prometeoService.fetchCatalogAndChartUrls(filter, productId)
        return JSON.parse(JSON.stringify(result))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[IPC] fetchCatalogAndChartUrls error:', msg)
        return {
          catalog: { products: [], categories: [], types: [], areas: [] },
          chartUrls: { productName: '', date: '', steps: [] },
          error: msg
        }
      }
    }
  )

  ipcMain.handle(
    IPC_CHANNELS.PROMETEO_FETCH_CHART_URLS_FOR_PPT,
    async (_event, productType: string, productId: string) => {
      try {
        const result = await prometeoService.fetchChartUrlsForPpt(productType, productId)
        return JSON.parse(JSON.stringify(result))
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('[IPC] fetchChartUrlsForPpt error:', msg)
        return { productName: '', date: '', steps: [], error: msg }
      }
    }
  )

  ipcMain.handle(IPC_CHANNELS.PROMETEO_FETCH_CHART_URLS, async (_event, productId: string) => {
    try {
      const result = await prometeoService.fetchChartUrls(productId)
      return JSON.parse(JSON.stringify(result))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] fetchChartUrls error:', msg)
      return { productName: '', date: '', steps: [], error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROMETEO_FETCH_IMAGE, async (_event, imageUrl: string) => {
    try {
      const dataUrl = await prometeoService.fetchImage(imageUrl)
      return { dataUrl }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[IPC] fetchImage error:', msg)
      return { dataUrl: null, error: msg }
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROMETEO_DOWNLOAD_CHARTS, async (event, urls: string[]) => {
    try {
      const mainWindow = BrowserWindow.fromWebContents(event.sender)
      const localPaths = await downloaderService.downloadCharts(urls, (progress) => {
        mainWindow?.webContents.send(IPC_CHANNELS.PROMETEO_DOWNLOAD_PROGRESS, progress)
      })
      return { localPaths }
    } catch (err) {
      console.error('[IPC] downloadCharts error:', err)
      return { localPaths: [], error: String(err) }
    }
  })
}
