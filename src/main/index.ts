import { app, BrowserWindow, shell, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
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

// ── Auto-updater ──
function setupAutoUpdater(): void {
  // Don't check for updates in dev mode
  if (is.dev) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', (info) => {
    console.log('[Updater] Update available:', info.version)
    mainWindow?.webContents.send('updater:status', {
      status: 'available',
      version: info.version
    })
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('updater:status', {
      status: 'downloading',
      percent: Math.round(progress.percent)
    })
  })

  autoUpdater.on('update-downloaded', (info) => {
    console.log('[Updater] Update downloaded:', info.version)
    mainWindow?.webContents.send('updater:status', {
      status: 'ready',
      version: info.version
    })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[Updater] No update available')
    mainWindow?.webContents.send('updater:status', {
      status: 'up-to-date'
    })
  })

  autoUpdater.on('error', (err) => {
    console.error('[Updater] Error:', err.message)
    mainWindow?.webContents.send('updater:status', {
      status: 'error',
      message: err.message
    })
  })

  // Check for updates 3 seconds after launch, then every 30 minutes
  setTimeout(() => autoUpdater.checkForUpdates(), 3000)
  setInterval(() => autoUpdater.checkForUpdates(), 30 * 60 * 1000)
}

// IPC: user clicks "install and restart"
ipcMain.handle('updater:install', () => {
  autoUpdater.quitAndInstall()
})

// IPC: manually check for updates
ipcMain.handle('updater:check', async () => {
  if (is.dev) return { status: 'dev' }
  try {
    const result = await autoUpdater.checkForUpdates()
    if (!result || !result.updateInfo) {
      return { status: 'up-to-date' }
    }
    return { status: 'checking' }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { status: 'error', message }
  }
})

// IPC: get current app version
ipcMain.handle('updater:get-version', () => {
  return app.getVersion()
})
