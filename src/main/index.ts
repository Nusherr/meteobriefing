import { app, BrowserWindow, shell, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import https from 'https'
import { registerAuthIpc } from './ipc/auth.ipc'
import { registerPrometeoIpc } from './ipc/prometeo.ipc'
import { registerTemplateIpc } from './ipc/template.ipc'
import { registerPptxIpc } from './ipc/pptx.ipc'

// Prevent EPIPE crashes when stdout/stderr pipe is broken (e.g. during HMR restart)
process.stdout?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
  throw err
})
process.stderr?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
  throw err
})

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  // Resolve app icon path (works in both dev and production)
  const iconPath = join(__dirname, '../../build/icon_1024.png')
  const appIcon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    icon: appIcon,
    title: 'MeteoBriefing',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Set dock icon on macOS
  if (process.platform === 'darwin' && app.dock && !appIcon.isEmpty()) {
    app.dock.setIcon(appIcon)
  }

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.meteobriefing.app')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register all IPC handlers
  registerAuthIpc()
  registerPrometeoIpc()
  registerTemplateIpc()
  registerPptxIpc()

  createWindow()
  setupAutoUpdater()

  app.on('activate', () => {
    if (!mainWindow) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Update checker via GitHub API ──
// We don't use electron-updater because the app is unsigned and auto-install
// won't work on macOS. Instead we check the latest GitHub release version
// and download the installer for the user to open.

interface ReleaseInfo {
  version: string
  downloadUrl: string // browser_download_url for the right asset
  fileName: string
}

function fetchLatestRelease(): Promise<ReleaseInfo | null> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Nusherr/meteobriefing/releases/latest',
      headers: { 'User-Agent': 'MeteoBriefing-Updater', Accept: 'application/vnd.github.v3+json' }
    }

    const parseRelease = (body: string): ReleaseInfo | null => {
      const json = JSON.parse(body)
      const version = (json.tag_name || '').replace('v', '')
      if (!version) return null

      // Find the right asset for this platform
      const isMac = process.platform === 'darwin'
      const assets: { name: string; browser_download_url: string }[] = json.assets || []
      const asset = assets.find((a) =>
        isMac ? a.name.endsWith('.dmg') : a.name.endsWith('.exe')
      )
      if (!asset) return null

      return { version, downloadUrl: asset.browser_download_url, fileName: asset.name }
    }

    https.get(options, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'MeteoBriefing-Updater' } }, (res2) => {
          let data = ''
          res2.on('data', (chunk) => { data += chunk })
          res2.on('end', () => { try { resolve(parseRelease(data)) } catch { reject(new Error('Parse error')) } })
        }).on('error', reject)
        return
      }
      if (res.statusCode !== 200) { reject(new Error(`GitHub API ${res.statusCode}`)); return }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => { try { resolve(parseRelease(data)) } catch { reject(new Error('Parse error')) } })
    }).on('error', reject)
  })
}

let cachedRelease: ReleaseInfo | null = null
let downloadedFilePath: string | null = null

function setupAutoUpdater(): void {
  if (is.dev) return

  const autoCheck = async () => {
    try {
      const release = await fetchLatestRelease()
      if (!release) return
      const current = app.getVersion()
      if (release.version !== current && release.version > current) {
        cachedRelease = release
        console.log('[Updater] Update available:', release.version)
        mainWindow?.webContents.send('updater:status', { status: 'available', version: release.version })
      }
    } catch (err) {
      console.error('[Updater] Auto-check error:', err instanceof Error ? err.message : err)
    }
  }
  setTimeout(autoCheck, 5000)
  setInterval(autoCheck, 60 * 60 * 1000)
}

// IPC: manually check for updates
ipcMain.handle('updater:check', async () => {
  if (is.dev) return { status: 'dev' }
  try {
    const release = await fetchLatestRelease()
    if (!release) {
      mainWindow?.webContents.send('updater:status', { status: 'up-to-date' })
      return { status: 'up-to-date' }
    }
    const current = app.getVersion()
    if (release.version !== current && release.version > current) {
      cachedRelease = release
      mainWindow?.webContents.send('updater:status', { status: 'available', version: release.version })
      return { status: 'available', version: release.version }
    }
    mainWindow?.webContents.send('updater:status', { status: 'up-to-date' })
    return { status: 'up-to-date' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[Updater] Check error:', message)
    mainWindow?.webContents.send('updater:status', { status: 'error', message })
    return { status: 'error', message }
  }
})

// IPC: download the update file with progress
ipcMain.handle('updater:download', async () => {
  if (!cachedRelease) return { ok: false, error: 'No release info' }

  const { downloadUrl, fileName } = cachedRelease
  const downloadDir = app.getPath('downloads')
  const filePath = join(downloadDir, fileName)

  return new Promise<{ ok: boolean; path?: string; error?: string }>((resolve) => {
    const doDownload = (url: string) => {
      https.get(url, { headers: { 'User-Agent': 'MeteoBriefing-Updater' } }, (res) => {
        // Follow redirects (GitHub uses them for release assets)
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          doDownload(res.headers.location)
          return
        }
        if (res.statusCode !== 200) {
          resolve({ ok: false, error: `HTTP ${res.statusCode}` })
          return
        }

        const totalBytes = parseInt(res.headers['content-length'] || '0', 10)
        let receivedBytes = 0

        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs')
        const fileStream = fs.createWriteStream(filePath)

        res.on('data', (chunk: Buffer) => {
          receivedBytes += chunk.length
          if (totalBytes > 0) {
            const percent = Math.round((receivedBytes / totalBytes) * 100)
            mainWindow?.webContents.send('updater:status', {
              status: 'downloading',
              percent,
              version: cachedRelease?.version
            })
          }
        })

        res.pipe(fileStream)

        fileStream.on('finish', () => {
          fileStream.close()
          downloadedFilePath = filePath
          mainWindow?.webContents.send('updater:status', {
            status: 'ready',
            version: cachedRelease?.version
          })
          resolve({ ok: true, path: filePath })
        })

        fileStream.on('error', (err: Error) => {
          resolve({ ok: false, error: err.message })
        })
      }).on('error', (err) => {
        resolve({ ok: false, error: err.message })
      })
    }

    doDownload(downloadUrl)
  })
})

// IPC: open the downloaded file (DMG/EXE)
ipcMain.handle('updater:open-file', () => {
  if (downloadedFilePath) {
    shell.openPath(downloadedFilePath)
  }
})

// IPC: get current app version
ipcMain.handle('updater:get-version', () => {
  return app.getVersion()
})
