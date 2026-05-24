import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Bot } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

const UPDATE_TYPES = ['message', 'callback_query', 'inline_query', 'edited_message', 'channel_post', 'poll', 'my_chat_member'];

const TYPE_COLORS: Record<string, string> = {
  message: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  callback_query: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  inline_query: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  edited_message: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  channel_post: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const PAGE_SIZE = 50;

export default function LogsPage() {
  const [botId, setBotId] = useState('');
  const [updateType, setUpdateType] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(0);
  const [rawLog, setRawLog] = useState<string | null>(null);

  const { data: bots } = useQuery({ queryKey: ['/api/bots'], queryFn: api.bots.list });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/logs/updates', botId, updateType, search, page],
    queryFn: () =>
      api.logs.updates({
        botId: botId || undefined,
        updateType: updateType || undefined,
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    refetchInterval: 10_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const botMap = Object.fromEntries((bots ?? []).map((b) => [b.id, b]));

  const handleSearch = () => { setSearch(searchInput); setPage(0); };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Update Logs</h1>
          <p className="text-sm text-muted-foreground">
            {data?.total?.toLocaleString() ?? '—'} total records
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={botId || 'all'} onValueChange={(v) => { setBotId(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-44" data-testid="select-bot-filter">
            <SelectValue placeholder="All bots" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All bots</SelectItem>
            {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={updateType || 'all'} onValueChange={(v) => { setUpdateType(v === 'all' ? '' : v); setPage(0); }}>
          <SelectTrigger className="w-44" data-testid="select-type-filter">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {UPDATE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            placeholder="Search text, username..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-56"
            data-testid="input-log-search"
          />
          <Button size="sm" onClick={handleSearch} data-testid="button-search">
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Time', 'Bot', 'Type', 'User', 'Chat', 'Text / File', 'Raw'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 10 }).map((_, i) => (
                      <tr key={i} className="border-b border-border/50">
                        {Array.from({ length: 7 }).map((_, j) => (
                          <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>
                        ))}
                      </tr>
                    ))
                  : data?.data.map((log) => (
                      <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(log.receivedAt), 'MM-dd HH:mm:ss')}
                        </td>
                        <td className="px-4 py-2 max-w-[100px] truncate text-xs">
                          {botMap[log.botId]?.name ?? log.botId.slice(0, 8)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYPE_COLORS[log.updateType] || 'bg-muted text-muted-foreground'}`}>
                            {log.updateType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {log.username ? `@${log.username}` : log.firstName ?? (log.userId ? `#${log.userId}` : '—')}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {log.chatType
                            ? <span className="capitalize">{log.chatType}{log.chatTitle ? ` · ${log.chatTitle.slice(0, 15)}` : ''}</span>
                            : '—'}
                        </td>
                        <td className="px-4 py-2 text-xs max-w-[200px] truncate">
                          {log.messageText ?? log.callbackData ?? log.fileType ?? '—'}
                        </td>
                        <td className="px-4 py-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => setRawLog(log.rawUpdate)}
                            data-testid={`button-raw-${log.id}`}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages} ({data?.total.toLocaleString()} records)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  data-testid="button-prev-page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                  data-testid="button-next-page"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw update modal */}
      <Dialog open={!!rawLog} onOpenChange={() => setRawLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Raw Update JSON</DialogTitle></DialogHeader>
          <pre className="text-xs overflow-auto max-h-[60vh] bg-muted p-4 rounded font-mono whitespace-pre-wrap">
            {rawLog ? JSON.stringify(JSON.parse(rawLog), null, 2) : ''}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
