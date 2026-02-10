import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../../stores/auth.store'
import { useTemplateStore } from '../../stores/template.store'
import { TemplateSelector } from './TemplateSelector'

interface UpdateStatus {
  status: 'available' | 'downloading' | 'ready' | 'up-to-date' | 'error' | 'checking'
  version?: string
  percent?: number
  message?: string
}

/**
 * NATO / Military time zones (A–Z, skipping J).
 * Each entry: letter, name, UTC offset in hours.
 */
const MILITARY_ZONES: { letter: string; name: string; offset: number }[] = [
  { letter: 'Z', name: 'Zulu (UTC)', offset: 0 },
  { letter: 'A', name: 'Alpha', offset: 1 },
  { letter: 'B', name: 'Bravo', offset: 2 },
  { letter: 'C', name: 'Charlie', offset: 3 },
  { letter: 'D', name: 'Delta', offset: 4 },
  { letter: 'E', name: 'Echo', offset: 5 },
  { letter: 'F', name: 'Foxtrot', offset: 6 },
  { letter: 'G', name: 'Golf', offset: 7 },
  { letter: 'H', name: 'Hotel', offset: 8 },
  { letter: 'I', name: 'India', offset: 9 },
  { letter: 'K', name: 'Kilo', offset: 10 },
  { letter: 'L', name: 'Lima', offset: 11 },
  { letter: 'M', name: 'Mike', offset: 12 },
  { letter: 'N', name: 'November', offset: -1 },
  { letter: 'O', name: 'Oscar', offset: -2 },
  { letter: 'P', name: 'Papa', offset: -3 },
  { letter: 'Q', name: 'Quebec', offset: -4 },
  { letter: 'R', name: 'Romeo', offset: -5 },
  { letter: 'S', name: 'Sierra', offset: -6 },
  { letter: 'T', name: 'Tango', offset: -7 },
  { letter: 'U', name: 'Uniform', offset: -8 },
  { letter: 'V', name: 'Victor', offset: -9 },
  { letter: 'W', name: 'Whiskey', offset: -10 },
  { letter: 'X', name: 'X-ray', offset: -11 },
  { letter: 'Y', name: 'Yankee', offset: -12 }
]

function formatTime(now: Date, offsetHours: number) {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000
  const shifted = new Date(utcMs + offsetHours * 3_600_000)
  const hh = String(shifted.getHours()).padStart(2, '0')
  const mm = String(shifted.getMinutes()).padStart(2, '0')
  const ss = String(shifted.getSeconds()).padStart(2, '0')
  const day = String(shifted.getDate()).padStart(2, '0')
  const month = String(shifted.getMonth() + 1).padStart(2, '0')
  return { hh, mm, ss, day, month }
}

interface ClockEntry {
  id: string
  letter: string
  offset: number
}

function ClockDisplay({ entry, now, onRemove }: { entry: ClockEntry; now: Date; onRemove?: () => void }) {
  const { hh, mm, ss, day, month } = formatTime(now, entry.offset)
  const zone = MILITARY_ZONES.find((z) => z.letter === entry.letter)
  const label = entry.letter === 'Z' ? 'UTC' : entry.letter

  return (
    <div className="flex items-center gap-1.5 text-xs tabular-nums text-slate-700 group/clock">
      <span className="font-semibold">
        {hh}:{mm}:{ss}
      </span>
      <span className="font-medium" title={zone?.name}>
        {label}
      </span>
      <span>{day}/{month}</span>
      {onRemove && (
        <button
          onClick={onRemove}
          className="w-3.5 h-3.5 text-slate-300 hover:text-red-500 text-[10px] leading-none flex items-center justify-center opacity-0 group-hover/clock:opacity-100 transition-opacity cursor-pointer"
          title="Rimuovi orologio"
        >
          ×
        </button>
      )}
    </div>
  )
}

function ClocksRow() {
  const [now, setNow] = useState(() => new Date())
  const [clocks, setClocks] = useState<ClockEntry[]>([
    { id: 'utc', letter: 'Z', offset: 0 }
  ])
  const [showPicker, setShowPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Close picker on outside click
  useEffect(() => {
    if (!showPicker) return
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showPicker])

  const addClock = useCallback(
    (zone: (typeof MILITARY_ZONES)[number]) => {
      // Don't add duplicates
      if (clocks.some((c) => c.letter === zone.letter)) return
      setClocks((prev) => [
        ...prev,
        { id: `tz-${zone.letter}-${Date.now()}`, letter: zone.letter, offset: zone.offset }
      ])
      setShowPicker(false)
    },
    [clocks]
  )

  const removeClock = useCallback((id: string) => {
    setClocks((prev) => prev.filter((c) => c.id !== id))
  }, [])

  // Zones already added
  const usedLetters = new Set(clocks.map((c) => c.letter))

  return (
    <div className="flex items-center gap-3">
      {clocks.map((entry) => (
        <ClockDisplay
          key={entry.id}
          entry={entry}
          now={now}
          onRemove={clocks.length > 1 ? () => removeClock(entry.id) : undefined}
        />
      ))}

      {/* Add clock button */}
      <div className="relative" ref={pickerRef}>
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="w-5 h-5 rounded-full border border-slate-300 hover:border-blue-400 hover:bg-blue-50 text-slate-400 hover:text-blue-600 text-xs flex items-center justify-center transition-colors cursor-pointer"
          title="Aggiungi fuso orario"
        >
          +
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 mt-1.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 w-[200px] max-h-[280px] overflow-y-auto py-1">
            {MILITARY_ZONES.map((zone) => {
              const used = usedLetters.has(zone.letter)
              const offsetStr =
                zone.offset === 0
                  ? 'UTC±0'
                  : zone.offset > 0
                    ? `UTC+${zone.offset}`
                    : `UTC${zone.offset}`
              return (
                <button
                  key={zone.letter}
                  onClick={() => addClock(zone)}
                  disabled={used}
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between ${
                    used
                      ? 'text-slate-300 cursor-not-allowed'
                      : 'text-slate-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="font-bold w-4 text-center">{zone.letter}</span>
                    <span>{zone.name}</span>
                  </span>
                  <span className="text-[10px] text-slate-400">{offsetStr}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function VersionBadge() {
  const [appVersion, setAppVersion] = useState<string>('')
  const [update, setUpdate] = useState<UpdateStatus | null>(null)
  const [checking, setChecking] = useState(false)
  const upToDateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    window.electronAPI.updater.getVersion().then(setAppVersion)
  }, [])

  useEffect(() => {
    const unsub = window.electronAPI.updater.onStatus((data) => {
      setChecking(false)
      setUpdate(data as UpdateStatus)

      // Auto-hide "up-to-date" after 4 seconds
      if (data.status === 'up-to-date' || data.status === 'error') {
        if (upToDateTimerRef.current) clearTimeout(upToDateTimerRef.current)
        upToDateTimerRef.current = setTimeout(() => setUpdate(null), 4000)
      }
    })
    return () => {
      unsub()
      if (upToDateTimerRef.current) clearTimeout(upToDateTimerRef.current)
    }
  }, [])

  const handleCheck = useCallback(async () => {
    setChecking(true)
    setUpdate(null)
    try {
      await window.electronAPI.updater.checkForUpdates()
    } catch {
      setChecking(false)
    }
  }, [])

  const handleInstall = useCallback(() => {
    window.electronAPI.updater.install()
  }, [])

  return (
    <div className="flex items-center gap-1.5">
      {/* Version number */}
      <span className="text-[10px] text-slate-400 font-mono">v{appVersion}</span>

      {/* Status indicators */}
      {update?.status === 'downloading' && (
        <div className="flex items-center gap-1.5">
          <div className="w-16 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300"
              style={{ width: `${update.percent || 0}%` }}
            />
          </div>
          <span className="text-[10px] text-blue-500 font-mono">{update.percent || 0}%</span>
        </div>
      )}

      {update?.status === 'available' && (
        <span className="text-[10px] text-blue-500 font-medium">
          v{update.version} disponibile...
        </span>
      )}

      {update?.status === 'ready' && (
        <button
          onClick={handleInstall}
          className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors cursor-pointer"
        >
          Aggiorna v{update.version}
        </button>
      )}

      {update?.status === 'up-to-date' && (
        <span className="text-[10px] text-emerald-500 font-medium flex items-center gap-0.5">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Aggiornato
        </span>
      )}

      {update?.status === 'error' && (
        <span className="text-[10px] text-red-400 font-medium">Errore</span>
      )}

      {/* Check for updates button */}
      {!update?.status || update.status === 'up-to-date' || update.status === 'error' ? (
        <button
          onClick={handleCheck}
          disabled={checking}
          className="w-4 h-4 flex items-center justify-center text-slate-300 hover:text-blue-500 transition-colors cursor-pointer disabled:opacity-50"
          title="Controlla aggiornamenti"
        >
          <svg
            className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      ) : null}
    </div>
  )
}

export function TopBar() {
  const { isLoggedIn } = useAuthStore()
  const { activeTemplate, isDirty, saveActiveTemplate } = useTemplateStore()

  return (
    <header className="drag-region h-12 bg-[var(--color-topbar-bg)] border-b border-slate-200 flex items-center justify-between px-5">
      {/* Left: connection dot + clocks */}
      <div className="no-drag flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-slate-300'}`}
          title={isLoggedIn ? 'Connesso a Prometeo' : 'Non connesso'}
        />
        <ClocksRow />
      </div>

      {/* Right: Version + Save button + Template selector */}
      <div className="no-drag flex items-center gap-3">
        <VersionBadge />

        {/* Visible save button (always present when dirty) */}
        {activeTemplate && isDirty && (
          <button
            onClick={() => saveActiveTemplate()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
            title="Salva modifiche (⌘S)"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Salva
          </button>
        )}

        <TemplateSelector />
      </div>
    </header>
  )
}
