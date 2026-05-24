import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import Dashboard from '@/pages/Dashboard'
import Bots from '@/pages/Bots'
import Logs from '@/pages/Logs'
import ErrorLogs from '@/pages/ErrorLogs'
import { LayoutDashboard, Bot, ScrollText, AlertTriangle, Activity, Moon, Sun } from 'lucide-react'

type Page = 'dashboard' | 'bots' | 'logs' | 'errors'

const NAV = [
  { id: 'dashboard' as Page, label: 'Dashboard',  icon: LayoutDashboard },
  { id: 'bots'      as Page, label: 'Bots',        icon: Bot },
  { id: 'logs'      as Page, label: 'Update Logs', icon: ScrollText },
  { id: 'errors'    as Page, label: 'Error Logs',  icon: AlertTriangle },
]

export default function App() {
  const [page,    setPage]    = useState<Page>('dashboard')
  const [dark,    setDark]    = useState(true)
  const [botId,   setBotId]   = useState<string | undefined>()

  const { data: bots } = useQuery({ queryKey: ['bots'], queryFn: api.bots.list })
  const running = bots?.filter(b => b.runtime?.isRunning).length ?? 0

  const toggleDark = () => {
    setDark(d => {
      document.documentElement.classList.toggle('dark', !d)
      return !d
    })
  }

  // Called from Dashboard when user clicks a bot name
  const goBot = (id: string) => { setBotId(id); setPage('bots') }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-950 text-gray-100">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">

        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xs">TG</div>
            <div>
              <div className="text-sm font-semibold leading-none">Bot Monitor</div>
              <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                <Activity className="w-3 h-3 text-green-400" />
                {running}/{bots?.length ?? 0} running
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setPage(id); if (id !== 'bots') setBotId(undefined) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors
                ${page === id
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-2 border-t border-gray-800 space-y-0.5">
          <button
            onClick={toggleDark}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-gray-100 transition-colors"
          >
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {dark ? 'Light mode' : 'Dark mode'}
          </button>
          <a
            href="/api/docs" target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-300 transition-colors"
          >
            Swagger API ↗
          </a>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto bg-gray-950">
        {page === 'dashboard' && <Dashboard onSelectBot={goBot} />}
        {page === 'bots'      && <Bots selectedId={botId} />}
        {page === 'logs'      && <Logs />}
        {page === 'errors'    && <ErrorLogs />}
      </main>
    </div>
  )
}
