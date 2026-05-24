import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { format } from 'date-fns'
import { Search, ChevronLeft, ChevronRight, X } from 'lucide-react'

const TYPES = [
  'message', 'callback_query', 'inline_query', 'edited_message',
  'channel_post', 'poll', 'poll_answer', 'my_chat_member', 'chat_member',
]

const TC: Record<string, string> = {
  message:        'bg-blue-900/50 text-blue-300',
  callback_query: 'bg-purple-900/50 text-purple-300',
  inline_query:   'bg-yellow-900/50 text-yellow-300',
  edited_message: 'bg-orange-900/50 text-orange-300',
  channel_post:   'bg-green-900/50 text-green-300',
}

const LIMIT = 50

export default function Logs() {
  const [botId,  setBotId]  = useState('')
  const [type,   setType]   = useState('')
  const [search, setSearch] = useState('')
  const [q,      setQ]      = useState('')
  const [page,   setPage]   = useState(0)
  const [raw,    setRaw]    = useState<string | null>(null)

  const { data: bots } = useQuery({ queryKey: ['bots'], queryFn: api.bots.list })
  const { data, isLoading } = useQuery({
    queryKey: ['logs-updates', botId, type, search, page],
    queryFn: () => api.logs.updates({
      botId:      botId || undefined,
      updateType: type  || undefined,
      search:     search || undefined,
      limit:  LIMIT,
      offset: page * LIMIT,
    }),
    refetchInterval: 10_000,
  })

  const pages  = data ? Math.ceil(data.total / LIMIT) : 0
  const botMap = Object.fromEntries((bots ?? []).map(b => [b.id, b]))

  const selectClass = `bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-300
    focus:outline-none focus:border-blue-500 transition-colors`

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-100">Update Logs</h1>
        <p className="text-sm text-gray-500">{data?.total?.toLocaleString() ?? '—'} total records</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select value={botId} onChange={e => { setBotId(e.target.value); setPage(0) }} className={selectClass}>
          <option value="">All bots</option>
          {bots?.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>

        <select value={type} onChange={e => { setType(e.target.value); setPage(0) }} className={selectClass}>
          <option value="">All types</option>
          {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="flex gap-1">
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { setSearch(q); setPage(0) } }}
            placeholder="Search text, @username…"
            className={`${selectClass} w-52`}
          />
          <button
            onClick={() => { setSearch(q); setPage(0) }}
            className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Search className="w-4 h-4 text-gray-400" />
          </button>
          {(botId || type || search) && (
            <button
              onClick={() => { setBotId(''); setType(''); setSearch(''); setQ(''); setPage(0) }}
              className="bg-gray-800 border border-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-700 text-gray-400 text-xs transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Time', 'Bot', 'Type', 'User', 'Chat', 'Text / Media', 'Raw'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-600">Loading…</td></tr>
                : (data?.data ?? []).map(log => (
                    <tr key={log.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">
                        {format(new Date(log.receivedAt), 'MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-300 max-w-[100px] truncate">
                        {botMap[log.botId]?.name ?? log.botId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                          ${TC[log.updateType] ?? 'bg-gray-800 text-gray-400'}`}>
                          {log.updateType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">
                        {log.username ? `@${log.username}` : (log.firstName ?? (log.userId ? `#${log.userId}` : '—'))}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 capitalize whitespace-nowrap">
                        {log.chatType ?? '—'}
                        {log.chatTitle ? ` · ${log.chatTitle.slice(0, 12)}` : ''}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-300 max-w-[180px] truncate">
                        {log.messageText ?? log.callbackData ?? log.fileType ?? '—'}
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => setRaw(log.rawUpdate)}
                          className="text-xs text-blue-500 hover:text-blue-400 transition-colors"
                        >
                          view
                        </button>
                      </td>
                    </tr>
                  ))
              }
              {!isLoading && data?.data.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-600">
                    No logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-500">
              Page {page + 1} / {pages} &nbsp;·&nbsp; {data?.total.toLocaleString()} records
            </span>
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

      {/* Raw JSON modal */}
      {raw && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <span className="text-sm font-medium text-gray-200">Raw Update JSON</span>
              <button onClick={() => setRaw(null)}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-200" />
              </button>
            </div>
            <pre className="text-xs font-mono p-4 overflow-auto text-gray-300 whitespace-pre-wrap flex-1">
              {JSON.stringify(JSON.parse(raw), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}
