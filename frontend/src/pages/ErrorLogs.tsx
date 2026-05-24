import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

const LC: Record<string, string> = {
  error: 'bg-red-900/50 text-red-400',
  warn:  'bg-yellow-900/50 text-yellow-400',
  info:  'bg-blue-900/50 text-blue-400',
}

const LIMIT = 50

export default function ErrorLogs() {
  const [botId, setBotId] = useState('')
  const [page,  setPage]  = useState(0)
  const [sel,   setSel]   = useState<any>(null)

  const { data: bots } = useQuery({ queryKey: ['bots'], queryFn: api.bots.list })
  const { data, isLoading } = useQuery({
    queryKey: ['logs-errors', botId, page],
    queryFn: () => api.logs.errors(botId || undefined, LIMIT, page * LIMIT),
    refetchInterval: 15_000,
  })

  const pages  = data ? Math.ceil(data.total / LIMIT) : 0
  const botMap = Object.fromEntries((bots ?? []).map(b => [b.id, b]))

  const errorCount = data?.data.filter(l => l.level === 'error').length ?? 0
  const warnCount  = data?.data.filter(l => l.level === 'warn').length ?? 0

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">Error Logs</h1>
        <p className="text-sm text-gray-500">
          {data?.total?.toLocaleString() ?? '—'} total
          {data && ` · ${errorCount} errors · ${warnCount} warnings on this page`}
        </p>
      </div>

      <select
        value={botId}
        onChange={e => { setBotId(e.target.value); setPage(0) }}
        className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-blue-500"
      >
        <option value="">All bots</option>
        {bots?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Time', 'Bot', 'Level', 'Message', ''].map((h, i) => (
                <th key={i} className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading
              ? <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-600">Loading…</td></tr>
              : (data?.data ?? []).map(log => (
                  <tr key={log.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                    <td className="px-4 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">
                      {format(new Date(log.createdAt), 'MM-dd HH:mm:ss')}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-300">
                      {log.botId ? (botMap[log.botId]?.name ?? log.botId.slice(0, 8)) : 'System'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LC[log.level] ?? 'bg-gray-800 text-gray-400'}`}>
                        {log.level}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-300 max-w-[360px] truncate">
                      {log.message}
                    </td>
                    <td className="px-4 py-2">
                      {(log.stack || log.context) && (
                        <button
                          onClick={() => setSel(log)}
                          className="text-xs text-blue-500 hover:text-blue-400 transition-colors whitespace-nowrap"
                        >
                          detail
                        </button>
                      )}
                    </td>
                  </tr>
                ))
            }
            {!isLoading && data?.data.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-600">
                  No error logs found
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">Page {page + 1} / {pages}</span>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="p-1.5 rounded-lg bg-gray-800 disabled:opacity-30 hover:bg-gray-700 transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pages - 1}
                onClick={() => setPage(p => p + 1)}
                className="p-1.5 rounded-lg bg-gray-800 disabled:opacity-30 hover:bg-gray-700 transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {sel && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LC[sel.level] ?? ''}`}>
                  {sel.level}
                </span>
                <span className="text-sm font-medium text-gray-200">Error Detail</span>
              </div>
              <button onClick={() => setSel(null)}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <p className="text-sm text-red-300 font-medium">{sel.message}</p>
              {sel.context && (() => {
                try {
                  return (
                    <div>
                      <p className="text-xs text-gray-500 mb-1.5 font-medium">Context</p>
                      <pre className="text-xs bg-gray-800 p-3 rounded-lg font-mono overflow-auto max-h-32 text-gray-300">
                        {JSON.stringify(JSON.parse(sel.context), null, 2)}
                      </pre>
                    </div>
                  )
                } catch {
                  return <p className="text-xs text-gray-400">{sel.context}</p>
                }
              })()}
              {sel.stack && (
                <div>
                  <p className="text-xs text-gray-500 mb-1.5 font-medium">Stack Trace</p>
                  <pre className="text-xs bg-gray-800 p-3 rounded-lg font-mono overflow-auto max-h-52 text-red-300 whitespace-pre-wrap">
                    {sel.stack}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
