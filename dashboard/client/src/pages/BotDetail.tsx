import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { MessageSquare, Users, AlertTriangle, Clock } from 'lucide-react';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6b7280'];

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: bot, isLoading } = useQuery({
    queryKey: ['/api/bots', id],
    queryFn: () => api.bots.get(id!),
    refetchInterval: 10_000,
  });

  const { data: summary } = useQuery({
    queryKey: ['/api/stats/bots', id],
    queryFn: () => api.stats.bot(id!),
    refetchInterval: 15_000,
  });

  const { data: hourlyData } = useQuery({
    queryKey: ['/api/logs/hourly', id],
    queryFn: () => api.logs.hourly(id!, Date.now() - 7 * 86_400_000, Date.now()),
    refetchInterval: 60_000,
  });

  const { data: typeStats } = useQuery({
    queryKey: ['/api/logs/types', id],
    queryFn: () => api.logs.typeStats(id!),
    refetchInterval: 30_000,
  });

  const { data: topUsers } = useQuery({
    queryKey: ['/api/logs/users', id],
    queryFn: () => api.logs.topUsers(id!, 10),
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="p-6"><Skeleton className="h-80 w-full" /></div>;
  if (!bot) return <div className="p-6 text-muted-foreground">Bot not found</div>;

  const chartData = hourlyData?.map((h) => ({
    time: format(new Date(h.hour), 'MM/dd HH:mm'),
    messages: h.messageCount,
    callbacks: h.callbackCount,
  })) ?? [];

  const pieData = typeStats?.map((t, i) => ({ name: t.updateType, value: t.count, color: PIE_COLORS[i % PIE_COLORS.length] })) ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">{bot.name}</h1>
            <Badge variant={bot.runtime?.isRunning ? 'default' : 'secondary'}>
              {bot.runtime?.isRunning ? '● running' : '○ stopped'}
            </Badge>
          </div>
          {bot.description && <p className="text-sm text-muted-foreground mt-1">{bot.description}</p>}
          <p className="text-xs text-muted-foreground mt-1 font-mono">ID: {bot.id}</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '24h Messages', value: summary?.messages24h ?? '—', icon: MessageSquare },
          { label: '7d Messages', value: summary?.messages7d ?? '—', icon: MessageSquare },
          { label: 'Unique Users', value: summary?.uniqueUsers ?? '—', icon: Users },
          { label: '24h Errors', value: summary?.errors24h ?? '—', icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
              <p className="text-xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Area chart */}
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Messages & Callbacks — Last 7 days (hourly)</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData} margin={{ left: -20, right: 0, top: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorMsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }} />
                  <Area type="monotone" dataKey="messages" stroke="hsl(var(--primary))" fill="url(#colorMsg)" strokeWidth={2} />
                  <Area type="monotone" dataKey="callbacks" stroke="#8b5cf6" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Update Types</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-sm text-muted-foreground">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={75} paddingAngle={2} dataKey="value">
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any, n: string) => [v, n]} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top 10 Users</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['#', 'User ID', 'Messages', 'First Seen', 'Last Seen'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {topUsers?.map((u, i) => (
                <tr key={u.userId} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                  <td className="px-4 py-2 font-mono text-xs">{u.userId}</td>
                  <td className="px-4 py-2 font-medium">{u.messageCount}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{format(new Date(u.firstMessageAt), 'yyyy-MM-dd HH:mm')}</td>
                  <td className="px-4 py-2 text-muted-foreground text-xs">{format(new Date(u.lastMessageAt), 'yyyy-MM-dd HH:mm')}</td>
                </tr>
              ))}
              {(!topUsers || topUsers.length === 0) && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground text-xs">No users yet</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
