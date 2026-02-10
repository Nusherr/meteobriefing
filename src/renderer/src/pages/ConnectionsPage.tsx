import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store'

export function ConnectionsPage() {
  const { isLoggedIn, username, isLoading, error, login, logout } = useAuthStore()
  const [formUser, setFormUser] = useState('')
  const [formPass, setFormPass] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(formUser, formPass)
  }

  return (
    <div className="h-full overflow-y-auto">
      <h2 className="text-xl font-semibold text-slate-800 mb-6">Connessioni</h2>

      {/* Prometeo Connection Card */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-slate-700">Prometeo</h3>
            <p className="text-xs text-slate-400 mt-0.5">prometeo2.meteoam.it</p>
          </div>
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-medium ${
              isLoggedIn
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-slate-100 text-slate-500'
            }`}
          >
            {isLoggedIn ? 'Connesso' : 'Non connesso'}
          </span>
        </div>

        {isLoggedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Connesso come <span className="font-medium">{username}</span>
            </p>
            <button
              onClick={logout}
              className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
            >
              Disconnetti
            </button>
          </div>
        ) : (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Username</label>
              <input
                type="text"
                value={formUser}
                onChange={(e) => setFormUser(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Username Prometeo"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1">Password</label>
              <input
                type="password"
                value={formPass}
                onChange={(e) => setFormPass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                placeholder="Password"
                required
              />
            </div>

            {error && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !formUser || !formPass}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connessione...' : 'Connetti'}
            </button>
          </form>
        )}
      </div>

      {/* Placeholder for future sources */}
      <div className="mt-4 bg-white rounded-xl p-6 shadow-sm border border-dashed border-slate-300 max-w-lg">
        <p className="text-sm text-slate-400 text-center">
          Altre fonti dati saranno disponibili in futuro
        </p>
      </div>
    </div>
  )
}
