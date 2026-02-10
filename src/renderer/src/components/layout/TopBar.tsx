import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '../../stores/auth.store'
import { useTemplateStore } from '../../stores/template.store'
import { TemplateSelector } from './TemplateSelector'

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

export function TopBar() {
  const { isLoggedIn } = useAuthStore()
  const { activeTemplate, isDirty, saveActiveTemplate } = useTemplateStore()

  return (
    <header className="h-12 bg-[var(--color-topbar-bg)] border-b border-slate-200 flex items-center justify-between px-5">
      {/* Left: connection dot + clocks */}
      <div className="flex items-center gap-3">
        <span
          className={`w-2 h-2 rounded-full ${isLoggedIn ? 'bg-emerald-500' : 'bg-slate-300'}`}
          title={isLoggedIn ? 'Connesso a Prometeo' : 'Non connesso'}
        />
        <ClocksRow />
      </div>

      {/* Right: Save button + Template selector */}
      <div className="flex items-center gap-2">
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
