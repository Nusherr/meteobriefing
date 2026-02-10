export const IPC_CHANNELS = {
  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_GET_SAVED: 'auth:get-saved-credentials',
  AUTH_SAVE: 'auth:save-credentials',
  AUTH_STATUS: 'auth:status',

  // Prometeo
  PROMETEO_FETCH_CATALOG: 'prometeo:fetch-catalog',
  PROMETEO_FETCH_CHART_URLS: 'prometeo:fetch-chart-urls',
  PROMETEO_FETCH_CATALOG_AND_CHART_URLS: 'prometeo:fetch-catalog-and-chart-urls',
  PROMETEO_FETCH_CHART_URLS_FOR_PPT: 'prometeo:fetch-chart-urls-for-ppt',
  PROMETEO_DOWNLOAD_CHARTS: 'prometeo:download-charts',
  PROMETEO_DOWNLOAD_PROGRESS: 'prometeo:download-progress',
  PROMETEO_FETCH_IMAGE: 'prometeo:fetch-image',
  PROMETEO_SESSION_EXPIRED: 'prometeo:session-expired',

  // Template
  TEMPLATE_LIST: 'template:list',
  TEMPLATE_LOAD: 'template:load',
  TEMPLATE_SAVE: 'template:save',
  TEMPLATE_DELETE: 'template:delete',

  // PPTX
  PPTX_GENERATE: 'pptx:generate',
  PPTX_PROGRESS: 'pptx:progress',

  // App
  APP_SELECT_SAVE_PATH: 'app:select-save-path',
  APP_SELECT_IMAGE: 'app:select-image',
  APP_SELECT_PPTX: 'app:select-pptx',
  APP_READ_LOCAL_IMAGE: 'app:read-local-image',
  APP_GET_CACHE_STATS: 'app:get-cache-stats',
  APP_CLEAR_CACHE: 'app:clear-cache'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
