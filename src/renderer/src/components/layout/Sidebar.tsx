import { useUiStore, type AppPage } from '../../stores/ui.store'
import { useAuthStore } from '../../stores/auth.store'

const navItems: { id: AppPage; label: string }[] = [
  { id: 'connections', label: 'Connessioni' },
  { id: 'products', label: 'Prodotti' },
  { id: 'briefing', label: 'Briefing' }
]

export function Sidebar() {
  const { currentPage, setPage } = useUiStore()
  const { isLoggedIn, username } = useAuthStore()

  return (
    <aside className="w-56 bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] flex flex-col h-full">
      {/* Logo area with drag region for macOS */}
      <div className="drag-region h-20 flex flex-col items-center justify-end pb-2">
        <span className="text-lg font-bold tracking-tight no-drag">Briefing Meteo</span>
        <span className="text-[9px] text-slate-500 tracking-wide no-drag">by Lorenzo Pecorale</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              currentPage === item.id
                ? 'bg-[var(--color-sidebar-active)] text-white'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Connection status footer */}
      <div className="px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${isLoggedIn ? 'bg-emerald-500' : 'bg-slate-500'}`}
          />
          <span className="text-xs text-slate-400 truncate">
            {isLoggedIn ? (username || 'Connesso') : 'Non connesso'}
          </span>
        </div>
      </div>
    </aside>
  )
}
