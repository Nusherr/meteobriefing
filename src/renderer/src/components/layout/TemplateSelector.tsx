import { useEffect, useRef, useState } from 'react'
import { useTemplateStore } from '../../stores/template.store'

export function TemplateSelector() {
  const {
    templateList,
    activeTemplate,
    isDirty,
    isLoadingList,
    fetchTemplateList,
    loadTemplate,
    loadLastTemplate,
    createNewTemplate,
    saveActiveTemplate,
    deleteTemplate,
    setActiveTemplateName
  } = useTemplateStore()

  const [open, setOpen] = useState(false)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameDraft, setRenameDraft] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const renameInputRef = useRef<HTMLInputElement>(null)
  const initializedRef = useRef(false)

  // Fetch template list on mount, then auto-load last used template
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    fetchTemplateList().then(() => {
      // Auto-load the last used template
      if (!activeTemplate) {
        loadLastTemplate()
      }
    })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
        setCreatingNew(false)
        setConfirmDeleteId(null)
        setRenamingId(null)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Focus input when creating new
  useEffect(() => {
    if (creatingNew && inputRef.current) {
      inputRef.current.focus()
    }
  }, [creatingNew])

  // Focus input when renaming
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  // Ctrl+S to save
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (activeTemplate && isDirty) {
          saveActiveTemplate()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeTemplate, isDirty, saveActiveTemplate])

  const handleCreate = () => {
    const trimmed = newName.trim()
    if (!trimmed) return
    createNewTemplate(trimmed)
    setNewName('')
    setCreatingNew(false)
    setOpen(false)
  }

  const handleSelect = (id: string) => {
    loadTemplate(id)
    setOpen(false)
  }

  const handleStartRename = (id: string, currentName: string) => {
    setRenamingId(id)
    setRenameDraft(currentName)
    setConfirmDeleteId(null)
  }

  const handleCommitRename = async () => {
    const trimmed = renameDraft.trim()
    if (!trimmed || !renamingId) {
      setRenamingId(null)
      return
    }

    // If renaming the active template, use the store action
    if (activeTemplate?.id === renamingId) {
      setActiveTemplateName(trimmed)
      await saveActiveTemplate()
    } else {
      // Load it, rename, save, then reload the original
      const currentActiveId = activeTemplate?.id
      await loadTemplate(renamingId)
      setActiveTemplateName(trimmed)
      await saveActiveTemplate()
      if (currentActiveId) {
        await loadTemplate(currentActiveId)
      }
    }
    setRenamingId(null)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm cursor-pointer"
      >
        {activeTemplate ? (
          <>
            <span className="text-slate-600 font-medium">{activeTemplate.name}</span>
            {isDirty && (
              <span className="w-2 h-2 rounded-full bg-amber-400" title="Modifiche non salvate" />
            )}
          </>
        ) : (
          <span className="text-slate-400">+ Nuovo Template</span>
        )}
        <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden">
          {/* Template list */}
          {isLoadingList ? (
            <div className="p-4 text-center text-xs text-slate-400">Caricamento...</div>
          ) : templateList.length > 0 ? (
            <div className="max-h-48 overflow-y-auto">
              {templateList.map((t) => (
                <div key={t.id} className="relative group">
                  {confirmDeleteId === t.id ? (
                    /* Confirm delete row */
                    <div className="flex items-center justify-between px-4 py-2.5 bg-red-50">
                      <span className="text-xs text-red-700 font-medium truncate">
                        Eliminare &quot;{t.name}&quot;?
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button
                          onClick={() => {
                            deleteTemplate(t.id)
                            setConfirmDeleteId(null)
                          }}
                          className="px-2 py-1 text-[10px] font-semibold bg-red-600 text-white rounded hover:bg-red-700 transition-colors cursor-pointer"
                        >
                          Elimina
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 text-[10px] font-medium text-slate-600 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors cursor-pointer"
                        >
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : renamingId === t.id ? (
                    /* Rename row */
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50">
                      <input
                        ref={renameInputRef}
                        value={renameDraft}
                        onChange={(e) => setRenameDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleCommitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        onBlur={handleCommitRename}
                        className="flex-1 px-2 py-1 text-sm border border-blue-300 rounded outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-0"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    /* Normal template row */
                    <div
                      className={`w-full text-left px-4 py-2.5 text-sm hover:bg-blue-50 transition-colors cursor-pointer flex items-center justify-between ${
                        activeTemplate?.id === t.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                      }`}
                    >
                      <span className="truncate cursor-pointer" onClick={() => handleSelect(t.id)}>{t.name}</span>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <span className="text-xs text-slate-400 mr-1">
                          {t.slideCount} slide
                        </span>
                        {/* Rename button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleStartRename(t.id, t.name)
                          }}
                          className="w-5 h-5 text-slate-400 hover:text-blue-600 text-xs flex items-center justify-center transition-colors cursor-pointer rounded hover:bg-blue-50"
                          title="Rinomina template"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfirmDeleteId(t.id)
                          }}
                          className="w-5 h-5 text-slate-400 hover:text-red-500 text-xs flex items-center justify-center transition-colors cursor-pointer rounded hover:bg-red-50"
                          title="Elimina template"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-slate-400">
              Nessun template salvato
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-slate-100" />

          {/* Create new */}
          {creatingNew ? (
            <div className="p-3 flex gap-2">
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') {
                    setCreatingNew(false)
                    setNewName('')
                  }
                }}
                placeholder="Nome template..."
                className="flex-1 px-3 py-1.5 text-sm border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:bg-slate-300 transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                Crea
              </button>
            </div>
          ) : (
            <button
              onClick={() => setCreatingNew(true)}
              className="w-full text-left px-4 py-2.5 text-sm text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer font-medium"
            >
              + Nuovo Template
            </button>
          )}

          {/* Save button (if dirty) */}
          {activeTemplate && isDirty && (
            <>
              <div className="border-t border-slate-100" />
              <button
                onClick={() => {
                  saveActiveTemplate()
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2.5 text-sm text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer font-medium"
              >
                Salva modifiche (⌘S)
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
