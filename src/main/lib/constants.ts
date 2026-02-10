import { app } from 'electron'
import { join } from 'path'

export const PROMETEO_BASE_URL = 'https://prometeo2.meteoam.it'
export const PROMETEO_LOGIN_URL = `${PROMETEO_BASE_URL}/`
export const PROMETEO_SEARCH_URL = `${PROMETEO_BASE_URL}/?q=ricercaProdotto_v2`

export function getUserDataPath(...segments: string[]): string {
  return join(app.getPath('userData'), ...segments)
}

export function getCachePath(): string {
  return getUserDataPath('cache', 'charts')
}

export function getTemplatesPath(): string {
  return getUserDataPath('templates')
}
