import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Bot } from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'
import {
  Play, Square, RotateCcw, Trash2, Plus, ChevronDown, ChevronUp,
  MessageSquare, Users, AlertCircle, X,
} from 'lucide-react'

function Card({ children, className = '' }: any) {
  return <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>{children}</div>
}

// ── Add Bot Modal ─────────────────────────────────────────────────────────────
function AddModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: '', token: '', alertChatId: '', description: '' })
  const mut = useMutation({
    mutationFn: () => api.bots.create({
      name: form.name,
      token: form.token,
      alertChatId: form.alertChatId || undefined,
      description: form.description || undefined,
    } as any),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bots'] }); onClose() },
  })

  const fields = [
    { key: 'name',        label: 'Name *',        ph: 'My Support Bot' },
    { key: 'token',       label: 'Bot Token *',   ph: '123456:ABC-DEF...' },
    { key: 'alertChatId', label: 'Alert Chat ID', ph: '-100123456789 (optional)' },
    { key: 'description', label: 'Description',   ph: 'optional' },
  ]

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100">Register New Bot</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-400 hover:text-gray-200" /></button>
        </div>

        {fields.map(f => (
          <div key={f.key}>
            <label className="text-xs text-gray-400 mb-1.5 block">{f.label}</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100
                placeholder-gray-600 focus:outline-none focus:border-blue-500 transition-colors"
              placeholder={f.ph}
              value={(form as any)[f.key]}
              onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
            />
          </div>
        ))}

        {mut.error && (
          <p className="text-xs text-red-400 bg-red-900/20 px-3 py-2 rounded">
            {(mut.error as Error).message}
          </p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!form.name.trim() || !form.token.trim() || mut.isPending}
            onClick={() => mut.mutate()}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 font-medium
              disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {mut.isPending ? 'Adding...' : 'Add & Start'}
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Bot Card ──────────────────────────────────────────────────────────────────
function BotCard({ bot, expanded, onToggle }: { bot: Bot; expanded: boolean; onToggle: () => void }) {
  const qc  = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: ['bots'] })

  const start   = useMutation({ mutationFn: () => api.bots.start(bot.id),   onSuccess: inv })
  const stop    = useMutation({ mutationFn: () => api.bots.stop(bot.id),    onSuccess: inv })
  const restart = useMutation({ mutationFn: () => api.bots.restart(bot.id), onSuccess: inv })
  const del     = useMutation({ mutationFn: () => api.bots.delete(bot.id),  onSuccess: inv })

  const running = bot.runtime?.isRunning

  return (
    <Card>
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-gray-100">{bot.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0
                ${running ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                {running ? '● running' : '○ stopped'}
              </span>
            </div>
            {bot.description && (
              <p className="text-xs text-gray-500 mt-0.5 truncate">{bot.description}</p>
            )}
          </div>
          <button onClick={onToggle} className="text-gray-600 hover:text-gray-300 flex-shrink-0 p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />{bot.totalMessages.toLocaleString()}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />{bot.totalUsers}
          </span>
          {!!bot.runtime?.errorCount && (
            <span className="flex items-center gap-1 text-red-400">
              <AlertCircle className="w-3 h-3" />{bot.runtime.errorCount} errors
            </span>
          )}
        </div>

        {/* Last error */}
        {bot.runtime?.lastError && (
          <p className="mt-2 text-xs text-red-400 bg-red-900/20 px-2 py-1 rounded truncate">
            {bot.runtime.lastError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 mt-3">
          {running
            ? <button
                onClick={() => stop.mutate()}
                disabled={stop.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 transition-colors"
              >
                <Square className="w-3 h-3" />Stop
              </button>
            : <button
                onClick={() => start.mutate()}
                disabled={start.isPending}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Play className="w-3 h-3" />Start
              </button>
          }
          <button
            onClick={() => restart.mutate()}
            disabled={restart.isPending}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 disabled:opacity-50 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />Restart
          </button>
          <button
            onClick={() => { if (confirm(`Delete "${bot.name}"? All logs will be removed.`)) del.mutate() }}
            className="ml-auto flex items-center px-2 py-1.5 rounded-lg text-xs text-red-500 hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-3 space-y-1.5 text-xs text-gray-400">
          <div><span className="text-gray-600 w-24 inline-block">ID:</span>
            <span className="font-mono text-gray-300">{bot.id}</span>
          </div>
          <div><span className="text-gray-600 w-24 inline-block">Token:</span>
            <span className="font-mono">{bot.token.slice(0, 14)}…</span>
          </div>
          {bot.alertChatId && (
            <div><span className="text-gray-600 w-24 inline-block">Alert chat:</span>{bot.alertChatId}</div>
          )}
          {bot.lastActivityAt && (
            <div><span className="text-gray-600 w-24 inline-block">Last activity:</span>
              {formatDistanceToNow(new Date(bot.lastActivityAt), { addSuffix: true })}
            </div>
          )}
          {bot.runtime?.startedAt && (
            <div><span className="text-gray-600 w-24 inline-block">Started:</span>
              {formatDistanceToNow(new Date(bot.runtime.startedAt), { addSuffix: true })}
            </div>
          )}
          {bot.runtime?.errorCount != null && (
            <div><span className="text-gray-600 w-24 inline-block">Session errors:</span>
              <span className={bot.runtime.errorCount > 0 ? 'text-red-400' : 'text-green-400'}>
                {bot.runtime.errorCount}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Bots({ selectedId }: { selectedId?: string }) {
  const [showAdd,  setShowAdd]  = useState(false)
  const [expanded, setExpanded] = useState<string | null>(selectedId ?? null)

  const { data: bots, isLoading } = useQuery({
    queryKey: ['bots'],
    queryFn: api.bots.list,
    refetchInterval: 8_000,
  })

  const running  = bots?.filter(b => b.runtime?.isRunning).length ?? 0
  const stopped  = (bots?.length ?? 0) - running

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Bots</h1>
          <p className="text-sm text-gray-500">
            {bots?.length ?? 0} registered · {running} running · {stopped} stopped
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm bg-blue-600 hover:bg-blue-700 font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />Add Bot
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && bots?.length === 0 && (
        <div className="py-20 text-center text-gray-600 text-sm">
          No bots yet — click Add Bot to register your first bot
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {bots?.map(b => (
          <BotCard
            key={b.id}
            bot={b}
            expanded={expanded === b.id}
            onToggle={() => setExpanded(p => p === b.id ? null : b.id)}
          />
        ))}
      </div>

      {showAdd && <AddModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
