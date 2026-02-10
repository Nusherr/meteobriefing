import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { createHash } from 'crypto'
import { authService } from './auth.service'
import { getCachePath, PROMETEO_BASE_URL } from '../lib/constants'
import type { DownloadProgress } from '@shared/types'

/** Minimum valid image size (1 KB) — anything smaller is likely an error page or empty */
const MIN_IMAGE_SIZE = 1024

class DownloaderService {
  private concurrency = 2 // reduced to avoid overwhelming the server

  async downloadCharts(
    urls: string[],
    onProgress?: (progress: DownloadProgress) => void
  ): Promise<string[]> {
    const cacheDir = getCachePath()
    mkdirSync(cacheDir, { recursive: true })

    const results: string[] = new Array(urls.length)
    let downloaded = 0

    // Process in batches
    const queue = urls.map((url, i) => ({ url, index: i }))
    const workers: Promise<void>[] = []

    for (let w = 0; w < Math.min(this.concurrency, queue.length); w++) {
      workers.push(
        this.worker(queue, results, cacheDir, () => {
          downloaded++
          onProgress?.({
            downloaded,
            total: urls.length,
            currentFile: `Immagine ${downloaded}/${urls.length}`
          })
        })
      )
    }

    await Promise.all(workers)
    return results
  }

  private async worker(
    queue: { url: string; index: number }[],
    results: string[],
    cacheDir: string,
    onDownloaded: () => void
  ): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()
      if (!item) break

      // Skip empty/invalid URLs
      if (!item.url || !item.url.startsWith('http')) {
        console.warn(`[Downloader] Invalid URL at index ${item.index}: "${item.url}"`)
        results[item.index] = ''
        onDownloaded()
        continue
      }

      const hash = createHash('sha256').update(item.url).digest('hex').substring(0, 16)
      const ext = item.url.toLowerCase().includes('.png') ? '.png' : '.jpg'
      const localPath = join(cacheDir, `${hash}${ext}`)

      // Check cache — but validate file size (reject corrupted/empty files)
      if (existsSync(localPath)) {
        try {
          const size = statSync(localPath).size
          if (size >= MIN_IMAGE_SIZE) {
            results[item.index] = localPath
            onDownloaded()
            continue
          }
          // File too small — delete and re-download
          console.warn(`[Downloader] Cached file too small (${size}B), re-downloading: ${localPath}`)
          unlinkSync(localPath)
        } catch {
          // stat/unlink failed — try downloading anyway
        }
      }

      // Try up to 3 times with increasing delay
      let success = false
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await this.downloadFile(item.url, localPath)

          // Verify downloaded file is valid
          const size = existsSync(localPath) ? statSync(localPath).size : 0
          if (size < MIN_IMAGE_SIZE) {
            throw new Error(`Downloaded file too small: ${size} bytes`)
          }

          results[item.index] = localPath
          success = true
          console.log(`[Downloader] OK: ${item.url} → ${localPath} (${size}B)`)
          break
        } catch (error) {
          console.warn(`[Downloader] Attempt ${attempt}/3 failed for ${item.url}:`, error)
          // Clean up partial/invalid file
          try {
            if (existsSync(localPath)) unlinkSync(localPath)
          } catch {
            /* ignore */
          }
          if (attempt < 3) {
            await new Promise((r) => setTimeout(r, 1500 * attempt))
          }
        }
      }
      if (!success) {
        console.error(`[Downloader] All 3 attempts failed for ${item.url}`)
        results[item.index] = ''
      }
      onDownloaded()
    }
  }

  private async downloadFile(url: string, destPath: string): Promise<void> {
    // Use the Prometeo BrowserWindow session for fetch — this automatically
    // sends all session cookies without us having to manually construct them
    const win = authService.getPrometeoWindow()
    const session = win.webContents.session

    console.log(`[Downloader] Fetching: ${url}`)
    const response = await session.fetch(url, {
      headers: {
        Referer: PROMETEO_BASE_URL
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText} for ${url}`)
    }

    // Check Content-Type — reject HTML responses (login pages, error pages)
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('text/html')) {
      throw new Error(`Got HTML response instead of image for ${url}`)
    }

    const buffer = await response.arrayBuffer()
    writeFileSync(destPath, Buffer.from(buffer))
  }
}

export const downloaderService = new DownloaderService()
