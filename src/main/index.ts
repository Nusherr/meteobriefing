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
// and let the user download manually.

function fetchLatestVersion(): Promise<string> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/Nusherr/meteobriefing/releases/latest',
      headers: { 'User-Agent': 'MeteoBriefing-Updater', Accept: 'application/vnd.github.v3+json' }
    }
    https.get(options, (res) => {
      // Follow redirect if needed
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        https.get(res.headers.location, { headers: { 'User-Agent': 'MeteoBriefing-Updater' } }, (res2) => {
          let data = ''
          res2.on('data', (chunk) => { data += chunk })
          res2.on('end', () => {
            try { resolve(JSON.parse(data).tag_name?.replace('v', '') || '') }
            catch { reject(new Error('Parse error')) }
          })
        }).on('error', reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`GitHub API returned ${res.statusCode}`))
        return
      }
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data).tag_name?.replace('v', '') || '') }
        catch { reject(new Error('Parse error')) }
      })
    }).on('error', reject)
  })
}

function setupAutoUpdater(): void {
  if (is.dev) return

  // Auto-check 5s after launch, then every 60 min (silent — only notifies if update found)
  const autoCheck = async () => {
    try {
      const latest = await fetchLatestVersion()
      const current = app.getVersion()
      if (latest && latest !== current && latest > current) {
        console.log('[Updater] Update available:', latest)
        mainWindow?.webContents.send('updater:status', { status: 'available', version: latest })
      }
    } catch (err) {
      console.error('[Updater] Auto-check error:', err instanceof Error ? err.message : err)
    }
  }
  setTimeout(autoCheck, 5000)
  setInterval(autoCheck, 60 * 60 * 1000)
}

// IPC: open GitHub releases page to download new version manually
ipcMain.handle('updater:open-download', () => {
  shell.openExternal('https://github.com/Nusherr/meteobriefing/releases/latest')
})

// IPC: manually check for updates
ipcMain.handle('updater:check', async () => {
  if (is.dev) return { status: 'dev' }
  try {
    const latest = await fetchLatestVersion()
    const current = app.getVersion()
    if (latest && latest !== current && latest > current) {
      mainWindow?.webContents.send('updater:status', { status: 'available', version: latest })
      return { status: 'available', version: latest }
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

// IPC: get current app version
ipcMain.handle('updater:get-version', () => {
  return app.getVersion()
})
