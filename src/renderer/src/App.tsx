import { useEffect } from 'react'
import { useAuthStore } from './stores/auth.store'
import { useUiStore } from './stores/ui.store'
import { AppShell } from './components/layout/AppShell'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ConnectionsPage } from './pages/ConnectionsPage'
import { ProductBrowserPage } from './pages/ProductBrowserPage'
import { BriefingEditorPage } from './pages/BriefingEditorPage'

function PageRouter() {
  const { currentPage } = useUiStore()

  switch (currentPage) {
    case 'connections':
      return <ConnectionsPage />
    case 'products':
      return <ProductBrowserPage />
    case 'briefing':
      return <BriefingEditorPage />
    default:
      return <ProductBrowserPage />
  }
}

export default function App() {
  const { autoLogin } = useAuthStore()

  useEffect(() => {
    autoLogin()
  }, [])

  return (
    <ErrorBoundary>
      <AppShell>
        <ErrorBoundary>
          <PageRouter />
        </ErrorBoundary>
      </AppShell>
    </ErrorBoundary>
  )
}
