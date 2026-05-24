import { useQuery } from '@tanstack/react-query';
import { api, Bot, UpdateLog } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Bot as BotIcon, Users, MessageSquare, AlertTriangle, Activity, Zap } from 'lucide-react';
import { format } from 'date-fns';

function StatCard({ label, value, icon: Icon, sub, color = 'text-primary' }: any) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
            <p className="text-xl font-bold mt-1 text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`p-2 rounded-lg bg-primary/10 ${color}`}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function UpdateTypeChip({ type }: { type: string }) {
  const colors: Record<string, string> = {
    message: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    callback_query: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    inline_query: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    edited_message: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    channel_post: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${colors[type] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
      {type}
    </span>
  );
}

export default function DashboardPage() {
  const { data: overview, isLoading: loadingOverview } = useQuery({
    queryKey: ['/api/stats/overview'],
    queryFn: api.stats.overview,
    refetchInterval: 10_000,
  });

  const { data: activity, isLoading: loadingActivity } = useQuery({
    queryKey: ['/api/stats/activity'],
    queryFn: () => api.stats.activity(30),
    refetchInterval: 8_000,
  });

  const { data: bots } = useQuery({
    queryKey: ['/api/bots'],
    queryFn: api.bots.list,
  });

  const { data: rateData } = useQuery({
    queryKey: ['/api/stats/message-rate'],
    queryFn: () => api.stats.messageRate(24),
    refetchInterval: 60_000,
  });

  // Aggregate rate data by hour
  const chartData = (() => {
    if (!rateData) return [];
    const map = new Map<number, number>();
    for (const row of rateData) {
      map.set(row.hour, (map.get(row.hour) || 0) + row.count);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hour, count]) => ({
        time: format(new Date(hour), 'HH:mm'),
        count,
      }));
  })();

  const statItems = [
    { label: 'Total Bots', value: overview?.totalBots ?? '—', icon: BotIcon, sub: `${overview?.activeBots ?? 0} active` },
    { label: 'Total Users', value: overview?.totalUsers?.toLocaleString() ?? '—', icon: Users },
    { label: 'Total Messages', value: overview?.totalMessages?.toLocaleString() ?? '—', icon: MessageSquare, sub: `${overview?.messages24h ?? 0} last 24h` },
    { label: 'Errors', value: overview?.totalErrors ?? '—', icon: AlertTriangle, color: 'text-destructive' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Real-time monitoring across all bots</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-500 font-medium">
          <Activity className="w-3.5 h-3.5 animate-pulse" />
          Live
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statItems.map((s) =>
          loadingOverview ? (
            <Card key={s.label}><CardContent className="pt-5"><Skeleton className="h-12 w-full" /></CardContent></Card>
          ) : (
            <StatCard key={s.label} {...s} />
          )
        )}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Message rate chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              Messages — last 24h
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Bot health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Bot Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {!bots
                ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)
                : bots.slice(0, 8).map((b) => (
                    <div key={b.id} className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground max-w-[130px]" title={b.name}>{b.name}</span>
                      <Badge variant={b.runtime?.isRunning ? 'default' : 'secondary'} className="text-xs">
                        {b.runtime?.isRunning ? '● running' : '○ stopped'}
                      </Badge>
                    </div>
                  ))}
              {bots?.length === 0 && (
                <p className="text-xs text-muted-foreground">No bots registered yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Time', 'Bot', 'Type', 'User', 'Text'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingActivity
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 5 }).map((_, j) => (
                          <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : activity?.map((log) => {
                      const bot = bots?.find((b) => b.id === log.botId);
                      return (
                        <tr key={log.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-2 text-muted-foreground whitespace-nowrap font-mono text-xs">
                            {format(new Date(log.receivedAt), 'HH:mm:ss')}
                          </td>
                          <td className="px-4 py-2 max-w-[120px] truncate text-foreground">
                            {bot?.name ?? log.botId.slice(0, 8)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap">
                            <UpdateTypeChip type={log.updateType} />
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {log.username ? `@${log.username}` : log.firstName ?? `#${log.userId}`}
                          </td>
                          <td className="px-4 py-2 text-foreground max-w-[250px] truncate">
                            {log.messageText ?? log.callbackData ?? log.fileType ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
              </tbody>
            </table>
            {activity?.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">No activity yet. Add a bot to start logging.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
