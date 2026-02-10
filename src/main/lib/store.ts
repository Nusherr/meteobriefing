import Store from 'electron-store'

interface StoreSchema {
  auth: {
    encryptedCredentials?: string
    username?: string
  }
  settings: {
    cacheSizeMB: number
    downloadConcurrency: number
  }
  recentTemplates: string[]
}

export const store = new Store<StoreSchema>({
  defaults: {
    auth: {},
    settings: {
      cacheSizeMB: 500,
      downloadConcurrency: 4
    },
    recentTemplates: []
  }
})
