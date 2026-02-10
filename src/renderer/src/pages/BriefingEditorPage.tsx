import { useState, useEffect } from 'react'
import { useTemplateStore } from '../stores/template.store'
import type { BriefingStyleMode } from '@shared/types'

/** Load a local image file as a data URL via IPC */
function useLocalImage(path?: string): string | null {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!path) {
      setDataUrl(null)
      return
    }
    let cancelled = false
    window.electronAPI.pptx.readLocalImage(path).then((url) => {
      if (!cancelled) setDataUrl(url)
    })
    return () => { cancelled = true }
  }, [path])
  return dataUrl
}

function ColorInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const handleTextChange = (raw: string) => {
    // Strip # if pasted, keep only valid hex chars, max 6
    const clean = raw.replace(/[^0-9a-fA-F]/g, '').slice(0, 6)
    onChange(clean)
  }

  return (
    <div className="flex items-center gap-2">
      {label && <label className="text-xs text-slate-500 w-28 shrink-0">{label}</label>}
      <div className="flex items-center gap-1.5">
        <input
          type="color"
          value={`#${(value || '000000').padEnd(6, '0')}`}
          onChange={(e) => onChange(e.target.value.replace('#', ''))}
          className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0"
        />
        <div className="flex items-center">
          <span className="text-[10px] text-slate-400 font-mono">#</span>
          <input
            type="text"
            value={value.toUpperCase()}
            onChange={(e) => handleTextChange(e.target.value)}
            className="text-[10px] text-slate-500 font-mono w-14 bg-transparent border-none outline-none p-0"
            maxLength={6}
            spellCheck={false}
          />
        </div>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-sm font-semibold text-slate-700 mb-3 mt-6 first:mt-0">{children}</h3>
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <label className="text-xs text-slate-500 w-28 shrink-0">{label}</label>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/** Filename from a full path, or null */
function fileName(path?: string): string | null {
  if (!path) return null
  return path.split('/').pop() || null
}

export function BriefingEditorPage() {
  const {
    activeTemplate,
    briefingStyle,
    updateCoverStyle,
    updateChartSlideStyle,
    setBriefingStyle
  } = useTemplateStore()

  const [coverImageName, setCoverImageName] = useState<string | null>(
    fileName(briefingStyle.cover.backgroundImagePath)
  )
  const [logoLeftName, setLogoLeftName] = useState<string | null>(
    fileName(briefingStyle.chartSlide.logoLeftPath)
  )
  const [logoRightName, setLogoRightName] = useState<string | null>(
    fileName(briefingStyle.chartSlide.logoRightPath)
  )

  // Load actual image previews
  const coverImageData = useLocalImage(briefingStyle.cover.backgroundImagePath)
  const logoLeftData = useLocalImage(briefingStyle.chartSlide.logoLeftPath)
  const logoRightData = useLocalImage(briefingStyle.chartSlide.logoRightPath)

  if (!activeTemplate) {
    return (
      <div>
        <h2 className="text-xl font-semibold text-slate-800 mb-6">Briefing</h2>
        <div className="bg-white rounded-xl p-8 shadow-sm border border-slate-200 text-center">
          <p className="text-slate-500 text-sm">
            Crea o seleziona un template per configurare lo stile del briefing.
          </p>
          <p className="text-xs text-slate-400 mt-2">
            Usa il selettore template in alto a destra.
          </p>
        </div>
      </div>
    )
  }

  const handleSelectCoverImage = async () => {
    const path = await window.electronAPI.pptx.selectImage()
    if (path) {
      updateCoverStyle({ backgroundImagePath: path })
      setCoverImageName(path.split('/').pop() || path)
    }
  }

  const handleRemoveCoverImage = () => {
    updateCoverStyle({ backgroundImagePath: undefined })
    setCoverImageName(null)
  }

  const handleSelectLogo = async (side: 'left' | 'right') => {
    const path = await window.electronAPI.pptx.selectImage()
    if (path) {
      if (side === 'left') {
        updateChartSlideStyle({ logoLeftPath: path })
        setLogoLeftName(path.split('/').pop() || path)
      } else {
        updateChartSlideStyle({ logoRightPath: path })
        setLogoRightName(path.split('/').pop() || path)
      }
    }
  }

  const handleRemoveLogo = (side: 'left' | 'right') => {
    if (side === 'left') {
      updateChartSlideStyle({ logoLeftPath: undefined })
      setLogoLeftName(null)
    } else {
      updateChartSlideStyle({ logoRightPath: undefined })
      setLogoRightName(null)
    }
  }

  const handleSelectCoverTemplate = async () => {
    const path = await window.electronAPI.pptx.selectPptx()
    if (path) {
      setBriefingStyle({
        custom: { ...briefingStyle.custom, coverTemplatePath: path }
      })
    }
  }

  const handleSelectChartTemplate = async () => {
    const path = await window.electronAPI.pptx.selectPptx()
    if (path) {
      setBriefingStyle({
        custom: { ...briefingStyle.custom, chartTemplatePath: path }
      })
    }
  }

  const setMode = (mode: BriefingStyleMode) => {
    setBriefingStyle({ mode })
  }

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-4">Briefing</h2>

      {/* Mode selector */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200 mb-4">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-sm font-medium text-slate-700">Modalita</span>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => setMode('builtin')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                briefingStyle.mode === 'builtin'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Integrato
            </button>
            <button
              onClick={() => setMode('custom')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                briefingStyle.mode === 'custom'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Modello PPTX
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400">
          {briefingStyle.mode === 'builtin'
            ? 'Configura copertina e stile slide direttamente qui.'
            : 'Carica i tuoi file PPTX modello con segnaposto (NAVE, DATA, TITOLO).'}
        </p>
      </div>

      {briefingStyle.mode === 'builtin' ? (
        /* ── BUILT-IN MODE ── */
        <div className="space-y-4">
          {/* Cover Slide */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Slide Copertina</h3>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={briefingStyle.cover.enabled}
                  onChange={(e) => updateCoverStyle({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4.5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600" />
              </label>
            </div>

            {briefingStyle.cover.enabled && (
              <>
                <FieldRow label="Titolo">
                  <input
                    type="text"
                    value={briefingStyle.cover.title}
                    onChange={(e) => updateCoverStyle({ title: e.target.value })}
                    placeholder="es. NAVE CAVOUR"
                    className="w-full px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FieldRow>

                {/* Colore titolo + Font size sulla stessa riga */}
                <div className="flex items-center gap-2 mb-2.5">
                  <label className="text-xs text-slate-500 w-28 shrink-0">Titolo</label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={`#${(briefingStyle.cover.titleColor || '000000').padEnd(6, '0')}`}
                      onChange={(e) => updateCoverStyle({ titleColor: e.target.value.replace('#', '') })}
                      className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0"
                    />
                    <div className="flex items-center">
                      <span className="text-[10px] text-slate-400 font-mono">#</span>
                      <input
                        type="text"
                        value={briefingStyle.cover.titleColor.toUpperCase()}
                        onChange={(e) => updateCoverStyle({ titleColor: e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6) })}
                        className="text-[10px] text-slate-500 font-mono w-14 bg-transparent border-none outline-none p-0"
                        maxLength={6}
                        spellCheck={false}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 ml-3">
                    <label className="text-xs text-slate-400">pt</label>
                    <input
                      type="number"
                      min={12}
                      max={72}
                      value={briefingStyle.cover.titleFontSize}
                      onChange={(e) => updateCoverStyle({ titleFontSize: Math.max(12, Math.min(72, Number(e.target.value) || 44)) })}
                      className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="mt-2.5">
                  <FieldRow label="Mostra data">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={briefingStyle.cover.showDate}
                        onChange={(e) => updateCoverStyle({ showDate: e.target.checked })}
                        className="rounded border-slate-300 cursor-pointer"
                      />
                      <span className="text-xs text-slate-600">Data del giorno (GG/MM/AAAA)</span>
                    </label>
                  </FieldRow>
                </div>

                {/* Colore data + Font size sulla stessa riga */}
                {briefingStyle.cover.showDate && (
                  <div className="flex items-center gap-2 mb-2.5">
                    <label className="text-xs text-slate-500 w-28 shrink-0">Data</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={`#${(briefingStyle.cover.dateColor || '000000').padEnd(6, '0')}`}
                        onChange={(e) => updateCoverStyle({ dateColor: e.target.value.replace('#', '') })}
                        className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0"
                      />
                      <div className="flex items-center">
                        <span className="text-[10px] text-slate-400 font-mono">#</span>
                        <input
                          type="text"
                          value={briefingStyle.cover.dateColor.toUpperCase()}
                          onChange={(e) => updateCoverStyle({ dateColor: e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6) })}
                          className="text-[10px] text-slate-500 font-mono w-14 bg-transparent border-none outline-none p-0"
                          maxLength={6}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 ml-3">
                      <label className="text-xs text-slate-400">pt</label>
                      <input
                        type="number"
                        min={10}
                        max={48}
                        value={briefingStyle.cover.dateFontSize}
                        onChange={(e) => updateCoverStyle({ dateFontSize: Math.max(10, Math.min(48, Number(e.target.value) || 24)) })}
                        className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>
                )}

                <div className="mt-3">
                  <ColorInput
                    label="Colore sfondo"
                    value={briefingStyle.cover.backgroundColor}
                    onChange={(v) => updateCoverStyle({ backgroundColor: v })}
                  />
                </div>

                <div className="mt-3">
                  <FieldRow label="Immagine sfondo">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSelectCoverImage}
                        className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                      >
                        {coverImageName ? 'Cambia' : 'Carica immagine'}
                      </button>
                      {coverImageName && (
                        <>
                          <span className="text-[10px] text-slate-400 truncate max-w-[120px]" title={briefingStyle.cover.backgroundImagePath}>
                            {coverImageName}
                          </span>
                          <button
                            onClick={handleRemoveCoverImage}
                            className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                            title="Rimuovi sfondo"
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  </FieldRow>
                </div>

                {/* Cover preview */}
                <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                  <p className="text-[9px] text-slate-400 px-2 pt-1.5 pb-1">Anteprima copertina</p>
                  <div
                    className="aspect-[16/9] relative flex flex-col items-center justify-center"
                    style={{ backgroundColor: `#${briefingStyle.cover.backgroundColor}` }}
                  >
                    {coverImageData && (
                      <>
                        <img src={coverImageData} alt="" className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50" />
                      </>
                    )}
                    <span
                      className="font-bold relative z-10"
                      style={{
                        color: `#${briefingStyle.cover.titleColor}`,
                        fontSize: `${Math.round(briefingStyle.cover.titleFontSize * 0.45)}px`
                      }}
                    >
                      {briefingStyle.cover.title || 'TITOLO'}
                    </span>
                    {briefingStyle.cover.showDate && (
                      <span
                        className="relative z-10 mt-1"
                        style={{
                          color: `#${briefingStyle.cover.dateColor}`,
                          fontSize: `${Math.round(briefingStyle.cover.dateFontSize * 0.45)}px`
                        }}
                      >
                        {new Date().toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Chart Slide Style */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <SectionTitle>Stile Slide Carte</SectionTitle>

            <ColorInput
              label="Colore barra"
              value={briefingStyle.chartSlide.headerBarColor}
              onChange={(v) => updateChartSlideStyle({ headerBarColor: v })}
            />

            {/* Colore titolo + Font size sulla stessa riga */}
            <div className="flex items-center gap-2 mb-2.5 mt-2.5">
              <label className="text-xs text-slate-500 w-28 shrink-0">Titolo</label>
              <div className="flex items-center gap-1.5">
                <input
                  type="color"
                  value={`#${(briefingStyle.chartSlide.titleColor || '000000').padEnd(6, '0')}`}
                  onChange={(e) => updateChartSlideStyle({ titleColor: e.target.value.replace('#', '') })}
                  className="w-7 h-7 rounded border border-slate-200 cursor-pointer p-0"
                />
                <div className="flex items-center">
                  <span className="text-[10px] text-slate-400 font-mono">#</span>
                  <input
                    type="text"
                    value={briefingStyle.chartSlide.titleColor.toUpperCase()}
                    onChange={(e) => updateChartSlideStyle({ titleColor: e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6) })}
                    className="text-[10px] text-slate-500 font-mono w-14 bg-transparent border-none outline-none p-0"
                    maxLength={6}
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-3">
                <label className="text-xs text-slate-400">pt</label>
                <input
                  type="number"
                  min={10}
                  max={48}
                  value={briefingStyle.chartSlide.titleFontSize}
                  onChange={(e) => updateChartSlideStyle({ titleFontSize: Math.max(10, Math.min(48, Number(e.target.value) || 20)) })}
                  className="w-16 px-2 py-1 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="mt-3">
              <FieldRow label="Tricolore">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={briefingStyle.chartSlide.tricoloreEnabled}
                    onChange={(e) => updateChartSlideStyle({ tricoloreEnabled: e.target.checked })}
                    className="rounded border-slate-300 cursor-pointer"
                  />
                  <span className="text-xs text-slate-600">Striscia tricolore sotto la barra</span>
                </label>
              </FieldRow>
            </div>

            {/* Logo Left */}
            <div className="mt-3">
              <FieldRow label="Logo sinistro">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectLogo('left')}
                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {logoLeftName ? 'Cambia' : 'Carica'}
                  </button>
                  {logoLeftName && (
                    <>
                      <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={briefingStyle.chartSlide.logoLeftPath}>
                        {logoLeftName}
                      </span>
                      <button
                        onClick={() => handleRemoveLogo('left')}
                        className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                        title="Rimuovi logo"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </FieldRow>
            </div>

            {/* Logo Right */}
            <div className="mt-1">
              <FieldRow label="Logo destro">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleSelectLogo('right')}
                    className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {logoRightName ? 'Cambia' : 'Carica'}
                  </button>
                  {logoRightName && (
                    <>
                      <span className="text-[10px] text-slate-400 truncate max-w-[100px]" title={briefingStyle.chartSlide.logoRightPath}>
                        {logoRightName}
                      </span>
                      <button
                        onClick={() => handleRemoveLogo('right')}
                        className="text-xs text-red-400 hover:text-red-600 cursor-pointer"
                        title="Rimuovi logo"
                      >
                        ×
                      </button>
                    </>
                  )}
                </div>
              </FieldRow>
            </div>

            {/* Live preview */}
            <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
              <p className="text-[9px] text-slate-400 px-2 pt-1.5 pb-1">Anteprima</p>
              <div className="bg-white aspect-[16/9] flex flex-col">
                {/* Header bar */}
                <div
                  className="w-full flex items-center justify-between px-2 relative"
                  style={{
                    backgroundColor: `#${briefingStyle.chartSlide.headerBarColor}`,
                    height: '12%'
                  }}
                >
                  {/* Logo left */}
                  <div className="h-full flex items-center py-0.5">
                    {logoLeftData ? (
                      <img src={logoLeftData} alt="Logo SX" className="h-full object-contain" />
                    ) : logoLeftName ? (
                      <div className="h-full aspect-square bg-white/20 rounded-sm flex items-center justify-center">
                        <span className="text-[6px] text-white/70">Logo</span>
                      </div>
                    ) : (
                      <div className="w-4" />
                    )}
                  </div>
                  {/* Title */}
                  <span
                    className="font-bold absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    style={{
                      color: `#${briefingStyle.chartSlide.titleColor}`,
                      fontSize: `${Math.round(briefingStyle.chartSlide.titleFontSize * 0.55)}px`
                    }}
                  >
                    TITOLO SLIDE
                  </span>
                  {/* Logo right */}
                  <div className="h-full flex items-center py-0.5">
                    {logoRightData ? (
                      <img src={logoRightData} alt="Logo DX" className="h-full object-contain" />
                    ) : logoRightName ? (
                      <div className="h-full aspect-square bg-white/20 rounded-sm flex items-center justify-center">
                        <span className="text-[6px] text-white/70">Logo</span>
                      </div>
                    ) : (
                      <div className="w-4" />
                    )}
                  </div>
                </div>
                {/* Tricolore */}
                {briefingStyle.chartSlide.tricoloreEnabled && (
                  <div className="w-full flex" style={{ height: '2%' }}>
                    <div className="flex-1 bg-green-600" />
                    <div className="flex-1 bg-white border-y border-slate-100" />
                    <div className="flex-1 bg-red-600" />
                  </div>
                )}
                {/* Content area placeholder */}
                <div className="flex-1 flex items-center justify-center p-2">
                  <div className="grid grid-cols-2 gap-1.5 w-full h-full">
                    <div className="bg-slate-100 rounded flex items-center justify-center">
                      <span className="text-[8px] text-slate-300">Carta 1</span>
                    </div>
                    <div className="bg-slate-100 rounded flex items-center justify-center">
                      <span className="text-[8px] text-slate-300">Carta 2</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ── CUSTOM PPTX MODE ── */
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <SectionTitle>Template Copertina</SectionTitle>
            <p className="text-[10px] text-slate-400 mb-3">
              Carica un PPTX con segnaposto (es. NAVE, DATA). Il programma li riconosce e li sostituisce.
            </p>

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={handleSelectCoverTemplate}
                className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer font-medium"
              >
                Carica PPTX copertina
              </button>
              {briefingStyle.custom.coverTemplatePath && (
                <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                  {briefingStyle.custom.coverTemplatePath.split('/').pop()}
                </span>
              )}
            </div>

            {/* Placeholder values */}
            {Object.keys(briefingStyle.custom.placeholderValues).length > 0 && (
              <div className="space-y-2 mt-3">
                <p className="text-[10px] text-slate-500 font-medium">Segnaposto trovati:</p>
                {Object.entries(briefingStyle.custom.placeholderValues).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-600 w-16 text-center shrink-0">
                      {key}
                    </span>
                    <input
                      type="text"
                      value={val}
                      onChange={(e) => {
                        const newValues = { ...briefingStyle.custom.placeholderValues, [key]: e.target.value }
                        setBriefingStyle({ custom: { ...briefingStyle.custom, placeholderValues: newValues } })
                      }}
                      className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={`Valore per ${key}`}
                    />
                    <ColorInput
                      label=""
                      value={briefingStyle.custom.placeholderColors[key] || '000000'}
                      onChange={(v) => {
                        const newColors = { ...briefingStyle.custom.placeholderColors, [key]: v }
                        setBriefingStyle({ custom: { ...briefingStyle.custom, placeholderColors: newColors } })
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-200">
            <SectionTitle>Template Slide Carte</SectionTitle>
            <p className="text-[10px] text-slate-400 mb-3">
              Carica un PPTX modello per le slide con le carte. Usa TITOLO come segnaposto.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={handleSelectChartTemplate}
                className="px-3 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors cursor-pointer font-medium"
              >
                Carica PPTX carte
              </button>
              {briefingStyle.custom.chartTemplatePath && (
                <span className="text-[10px] text-slate-500 truncate max-w-[200px]">
                  {briefingStyle.custom.chartTemplatePath.split('/').pop()}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
