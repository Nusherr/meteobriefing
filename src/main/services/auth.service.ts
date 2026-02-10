import { safeStorage, BrowserWindow } from 'electron'
import { store } from '../lib/store'
import { PROMETEO_BASE_URL } from '../lib/constants'

export interface Credentials {
  username: string
  password: string
}

export interface AuthStatus {
  isLoggedIn: boolean
  username?: string
}

class AuthService {
  private loggedIn = false
  private currentUsername?: string
  private prometeoWindow: BrowserWindow | null = null

  getSavedCredentials(): { username: string } | null {
    const username = store.get('auth.username')
    const encrypted = store.get('auth.encryptedCredentials')
    if (username && encrypted) {
      return { username }
    }
    return null
  }

  saveCredentials(creds: Credentials): void {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('Encryption not available on this system')
    }
    const encrypted = safeStorage.encryptString(JSON.stringify(creds))
    store.set('auth.encryptedCredentials', encrypted.toString('base64'))
    store.set('auth.username', creds.username)
  }

  private loadCredentials(): Credentials | null {
    const encoded = store.get('auth.encryptedCredentials')
    if (!encoded) return null

    try {
      const buffer = Buffer.from(encoded, 'base64')
      const decrypted = safeStorage.decryptString(buffer)
      return JSON.parse(decrypted) as Credentials
    } catch {
      return null
    }
  }

  clearCredentials(): void {
    store.delete('auth.encryptedCredentials' as never)
    store.delete('auth.username' as never)
  }

  getPrometeoWindow(): BrowserWindow {
    if (!this.prometeoWindow || this.prometeoWindow.isDestroyed()) {
      this.prometeoWindow = new BrowserWindow({
        show: false,
        width: 1280,
        height: 900,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })
    }
    return this.prometeoWindow
  }

  async login(creds?: Credentials): Promise<AuthStatus> {
    const credentials = creds || this.loadCredentials()
    if (!credentials) {
      return { isLoggedIn: false }
    }

    const win = this.getPrometeoWindow()

    try {
      await win.loadURL(PROMETEO_BASE_URL).catch((err: Error) => {
        console.log('[Auth] loadURL rejected (may be ok):', err.message)
      })

      // Wait for login page to load
      await win.webContents.executeJavaScript(`
        new Promise((resolve) => {
          if (document.readyState === 'complete') resolve(true);
          else window.addEventListener('load', () => resolve(true));
        })
      `)

      // Check if already logged in (redirected to main page)
      const isAlreadyLoggedIn = await win.webContents.executeJavaScript(`
        !!document.querySelector('a[href*="logout"]') ||
        document.body.textContent.includes('Esci')
      `)

      if (isAlreadyLoggedIn) {
        this.loggedIn = true
        this.currentUsername = credentials.username
        if (creds) this.saveCredentials(creds)
        return { isLoggedIn: true, username: credentials.username }
      }

      // Fill login form and submit
      await win.webContents.executeJavaScript(`
        (function() {
          const userField = document.querySelector('input[name="name"], input[name="username"], input[id="edit-name"]');
          const passField = document.querySelector('input[name="pass"], input[name="password"], input[id="edit-pass"]');
          if (userField && passField) {
            userField.value = ${JSON.stringify(credentials.username)};
            passField.value = ${JSON.stringify(credentials.password)};
            const form = userField.closest('form');
            if (form) {
              const submit = form.querySelector('input[type="submit"], button[type="submit"]');
              if (submit) submit.click();
              else form.submit();
            }
          }
        })()
      `)

      // Wait for navigation after login
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 15000)
        win.webContents.once('did-finish-load', () => {
          clearTimeout(timeout)
          resolve()
        })
      })

      // Check if login succeeded
      const loginSuccess = await win.webContents.executeJavaScript(`
        !!document.querySelector('a[href*="logout"]') ||
        document.body.textContent.includes('Esci') ||
        document.body.textContent.includes('Profilo utente')
      `)

      if (loginSuccess) {
        this.loggedIn = true
        this.currentUsername = credentials.username
        if (creds) this.saveCredentials(creds)
        return { isLoggedIn: true, username: credentials.username }
      }

      return { isLoggedIn: false }
    } catch (error) {
      console.error('Login failed:', error)
      return { isLoggedIn: false }
    }
  }

  async logout(): Promise<void> {
    if (this.prometeoWindow && !this.prometeoWindow.isDestroyed()) {
      await this.prometeoWindow.webContents.session.clearStorageData()
      this.prometeoWindow.destroy()
      this.prometeoWindow = null
    }
    this.loggedIn = false
    this.currentUsername = undefined
  }

  getStatus(): AuthStatus {
    return {
      isLoggedIn: this.loggedIn,
      username: this.currentUsername
    }
  }

  async getSessionCookies(): Promise<Electron.Cookie[]> {
    const win = this.getPrometeoWindow()
    return win.webContents.session.cookies.get({ url: PROMETEO_BASE_URL })
  }
}

export const authService = new AuthService()
