import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const LEVEL_COLORS: Record<string, string> = {
  error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  warn: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  info: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
};

const PAGE_SIZE = 50;

export default function ErrorLogsPage() {
  const [botId, setBotId] = useState('');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any | null>(null);

  const { data: bots } = useQuery({ queryKey: ['/api/bots'], queryFn: api.bots.list });
  const { data, isLoading } = useQuery({
    queryKey: ['/api/logs/errors', botId, page],
    queryFn: () => api.logs.errors(botId || undefined, PAGE_SIZE, page * PAGE_SIZE),
    refetchInterval: 15_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const botMap = Object.fromEntries((bots ?? []).map((b) => [b.id, b]));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Error Logs</h1>
          <p className="text-sm text-muted-foreground">{data?.total?.toLocaleString() ?? '—'} total</p>
        </div>
      </div>

      <Select value={botId || 'all'} onValueChange={(v) => { setBotId(v === 'all' ? '' : v); setPage(0); }}>
        <SelectTrigger className="w-44" data-testid="select-error-bot">
          <SelectValue placeholder="All bots" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All bots</SelectItem>
          {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Time', 'Bot', 'Level', 'Message', 'Detail'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-border/50">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                : data?.data.map((log) => (
                    <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(log.createdAt), 'MM-dd HH:mm:ss')}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {log.botId ? (botMap[log.botId]?.name ?? log.botId.slice(0, 8)) : 'System'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${LEVEL_COLORS[log.level] || ''}`}>
                          {log.level}
                        </span>
                      </td>
                      <td className="px-4 py-2 max-w-[320px] truncate text-xs">{log.message}</td>
                      <td className="px-4 py-2">
                        {(log.stack || log.context) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs px-2"
                            onClick={() => setSelected(log)}
                            data-testid={`button-error-detail-${log.id}`}
                          >
                            View
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Error Detail — {selected?.level}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm font-medium">{selected?.message}</p>
            {selected?.context && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Context</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-32 font-mono">
                  {JSON.stringify(JSON.parse(selected.context), null, 2)}
                </pre>
              </div>
            )}
            {selected?.stack && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Stack Trace</p>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                  {selected.stack}
                </pre>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
