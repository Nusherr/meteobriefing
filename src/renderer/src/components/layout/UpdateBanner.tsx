import { useEffect, useState } from 'react'

interface UpdateStatus {
  status: 'available' | 'downloading' | 'ready'
  version?: string
  percent?: number
}

export function UpdateBanner() {
  const [update, setUpdate] = useState<UpdateStatus | null>(null)

  useEffect(() => {
    const unsub = window.electronAPI.updater.onStatus((data) => {
      setUpdate(data as UpdateStatus)
    })
    return unsub
  }, [])

  if (!update) return null

  const handleInstall = () => {
    window.electronAPI.updater.install()
  }

  return (
    <div className="px-4 py-2 bg-blue-600 text-white text-xs flex items-center justify-between gap-3">
      {update.status === 'available' && (
        <span>Aggiornamento v{update.version} disponibile. Download in corso...</span>
      )}
      {update.status === 'downloading' && (
        <div className="flex items-center gap-2 flex-1">
          <span>Scaricamento aggiornamento...</span>
          <div className="flex-1 max-w-[200px] h-1.5 bg-blue-400 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: `${update.percent || 0}%` }}
            />
          </div>
          <span className="font-mono">{update.percent || 0}%</span>
        </div>
      )}
      {update.status === 'ready' && (
        <>
          <span>Aggiornamento v{update.version} pronto!</span>
          <button
            onClick={handleInstall}
            className="px-3 py-1 bg-white text-blue-600 rounded font-semibold hover:bg-blue-50 transition-colors cursor-pointer"
          >
            Riavvia e aggiorna
          </button>
        </>
      )}
    </div>
  )
}
