import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { format } from 'date-fns'
import { Bot, Users, MessageSquare, AlertTriangle, Activity } from 'lucide-react'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-gray-900 border border-gray-800 rounded-xl ${className}`}>
      {children}
    </div>
  )
}

function KPI({ label, value, sub, Icon, red = false }: {
  label: string; value: any; sub?: string; Icon: any; red?: boolean
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-100">{value ?? '—'}</p>
          {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${red ? 'bg-red-900/40 text-red-400' : 'bg-blue-900/40 text-blue-400'}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </Card>
  )
}

const TYPE_COLOR: Record<string, string> = {
  message:        'bg-blue-900/50 text-blue-300',
  callback_query: 'bg-purple-900/50 text-purple-300',
  inline_query:   'bg-yellow-900/50 text-yellow-300',
  edited_message: 'bg-orange-900/50 text-orange-300',
  channel_post:   'bg-green-900/50 text-green-300',
}

export default function Dashboard({ onSelectBot }: { onSelectBot: (id: string) => void }) {
  const { data: ov }   = useQuery({ queryKey: ['overview'],     queryFn: api.stats.overview,          refetchInterval: 8_000 })
  const { data: act }  = useQuery({ queryKey: ['activity'],     queryFn: () => api.stats.activity(30), refetchInterval: 8_000 })
  const { data: bots } = useQuery({ queryKey: ['bots'],         queryFn: api.bots.list,                refetchInterval: 10_000 })
  const { data: rate } = useQuery({ queryKey: ['rate'],         queryFn: () => api.stats.messageRate(24), refetchInterval: 60_000 })

  // Aggregate rate data per hour across all bots
  const chart = (() => {
    if (!rate) return []
    const m = new Map<number, number>()
    rate.forEach((r: any) => m.set(r.hour, (m.get(r.hour) ?? 0) + r.count))
    return [...m.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([h, c]) => ({ t: format(new Date(h), 'HH:mm'), c }))
  })()

  const botMap = Object.fromEntries((bots ?? []).map(b => [b.id, b]))

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-100">Dashboard</h1>
          <p className="text-sm text-gray-500">Real-time monitoring across all bots</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs text-green-400 font-medium">
          <Activity className="w-3.5 h-3.5 animate-pulse" /> Live
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI label="Total Bots"     value={ov?.totalBots}                         sub={`${ov?.activeBots ?? 0} active`}  Icon={Bot} />
        <KPI label="Total Users"    value={ov?.totalUsers?.toLocaleString()}                                              Icon={Users} />
        <KPI label="Messages"       value={ov?.totalMessages?.toLocaleString()}   sub={`${ov?.messages24h ?? 0} last 24h`} Icon={MessageSquare} />
        <KPI label="Errors"         value={ov?.totalErrors}                                                               Icon={AlertTriangle} red />
      </div>

      {/* Chart + bot list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="col-span-2 p-4">
          <p className="text-sm font-medium text-gray-300 mb-3">Messages — last 24h</p>
          {chart.length === 0
            ? <div className="h-44 flex items-center justify-center text-sm text-gray-600">No data yet</div>
            : <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chart} margin={{ left: -20, right: 0, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="t" tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b7280' }} />
                  <Tooltip
                    contentStyle={{ background: '#111827', border: '1px solid #1f2937', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: '#e5e7eb' }}
                  />
                  <Bar dataKey="c" name="messages" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
          }
        </Card>

        <Card className="p-4">
          <p className="text-sm font-medium text-gray-300 mb-3">Bot Status</p>
          <div className="space-y-2">
            {(bots ?? []).slice(0, 8).map(b => (
              <div key={b.id} className="flex items-center justify-between gap-2">
                <button
                  onClick={() => onSelectBot(b.id)}
                  className="text-sm text-gray-300 hover:text-white truncate text-left max-w-[120px]"
                >
                  {b.name}
                </button>
                <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
                  ${b.runtime?.isRunning ? 'bg-green-900/50 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
                  {b.runtime?.isRunning ? '● on' : '○ off'}
                </span>
              </div>
            ))}
            {!bots?.length && <p className="text-xs text-gray-600">No bots yet</p>}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <div className="px-4 py-3 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300">Recent Activity</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Time', 'Bot', 'Type', 'User', 'Text'].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(act ?? []).map(log => (
                <tr key={log.id} className="border-b border-gray-800/40 hover:bg-gray-800/20 transition-colors">
                  <td className="px-4 py-2 font-mono text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(log.receivedAt), 'HH:mm:ss')}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-300 max-w-[100px] truncate">
                    {botMap[log.botId]?.name ?? log.botId.slice(0, 8)}
                  </td>
                  <td className="px-4 py-2">
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                      ${TYPE_COLOR[log.updateType] ?? 'bg-gray-800 text-gray-400'}`}>
                      {log.updateType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-400">
                    {log.username ? `@${log.username}` : (log.firstName ?? `#${log.userId}`)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-300 max-w-[220px] truncate">
                    {log.messageText ?? log.callbackData ?? log.fileType ?? '—'}
                  </td>
                </tr>
              ))}
              {!act?.length && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-600">
                    No activity yet — add a bot to start logging
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
