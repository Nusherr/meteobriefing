import { create } from 'zustand'

interface AuthState {
  isLoggedIn: boolean
  username: string | null
  isLoading: boolean
  error: string | null
  login: (username: string, password: string) => Promise<boolean>
  autoLogin: () => Promise<boolean>
  logout: () => Promise<void>
  checkStatus: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: false,
  username: null,
  isLoading: false,
  error: null,

  login: async (username: string, password: string) => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.electronAPI.auth.login({ username, password })
      if (result.isLoggedIn) {
        set({ isLoggedIn: true, username: result.username, isLoading: false })
        return true
      } else {
        set({ isLoading: false, error: 'Credenziali non valide' })
        return false
      }
    } catch (err) {
      set({ isLoading: false, error: 'Errore di connessione' })
      return false
    }
  },

  autoLogin: async () => {
    const saved = await window.electronAPI.auth.getSavedCredentials()
    if (!saved) return false

    set({ isLoading: true, error: null })
    try {
      const result = await window.electronAPI.auth.login()
      if (result.isLoggedIn) {
        set({ isLoggedIn: true, username: result.username, isLoading: false })
        return true
      }
      set({ isLoading: false })
      return false
    } catch {
      set({ isLoading: false })
      return false
    }
  },

  logout: async () => {
    await window.electronAPI.auth.logout()
    set({ isLoggedIn: false, username: null })
  },

  checkStatus: async () => {
    const status = await window.electronAPI.auth.getStatus()
    set({ isLoggedIn: status.isLoggedIn, username: status.username })
  }
}))
