import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { api, Bot } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Play, Square, RotateCcw, Trash2, ExternalLink, AlertCircle, MessageSquare, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function BotCard({ bot, onStart, onStop, onRestart, onDelete }: {
  bot: Bot;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onDelete: () => void;
}) {
  const running = bot.runtime?.isRunning;
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold truncate">{bot.name}</CardTitle>
              <Badge variant={running ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                {running ? '● running' : '○ stopped'}
              </Badge>
            </div>
            {bot.description && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{bot.description}</p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Stats row */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{bot.totalMessages.toLocaleString()} msgs</span>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="w-3.5 h-3.5" />
            <span>{bot.totalUsers} users</span>
          </div>
          {bot.runtime?.errorCount ? (
            <div className="flex items-center gap-1.5 text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{bot.runtime.errorCount} errors</span>
            </div>
          ) : null}
        </div>

        {/* Last activity */}
        <p className="text-xs text-muted-foreground">
          {bot.lastActivityAt
            ? `Last activity ${formatDistanceToNow(new Date(bot.lastActivityAt), { addSuffix: true })}`
            : 'No activity yet'}
        </p>

        {/* Error badge */}
        {bot.runtime?.lastError && (
          <p className="text-xs text-destructive truncate bg-destructive/10 px-2 py-1 rounded">
            {bot.runtime.lastError}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {running ? (
            <Button size="sm" variant="outline" onClick={onStop} data-testid={`button-stop-${bot.id}`}>
              <Square className="w-3 h-3 mr-1" /> Stop
            </Button>
          ) : (
            <Button size="sm" variant="default" onClick={onStart} data-testid={`button-start-${bot.id}`}>
              <Play className="w-3 h-3 mr-1" /> Start
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onRestart} data-testid={`button-restart-${bot.id}`}>
            <RotateCcw className="w-3 h-3 mr-1" /> Restart
          </Button>
          <Link href={`/bots/${bot.id}`}>
            <Button size="sm" variant="ghost" data-testid={`button-detail-${bot.id}`}>
              <ExternalLink className="w-3 h-3 mr-1" /> Detail
            </Button>
          </Link>
          <Button size="sm" variant="ghost" onClick={onDelete} className="ml-auto text-destructive hover:text-destructive" data-testid={`button-delete-${bot.id}`}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AddBotDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', token: '', alertChatId: '', description: '' });
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: () => api.bots.create({
      name: form.name.trim(),
      token: form.token.trim(),
      alertChatId: form.alertChatId.trim() || undefined,
      description: form.description.trim() || undefined,
    }),
    onSuccess: () => {
      toast({ title: 'Bot added', description: `${form.name} is being started...` });
      setOpen(false);
      setForm({ name: '', token: '', alertChatId: '', description: '' });
      onCreated();
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" data-testid="button-add-bot">
          <Plus className="w-4 h-4 mr-1.5" /> Add Bot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Register new bot</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="My Support Bot" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="input-bot-name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token">Bot Token</Label>
            <Input id="token" placeholder="123456:ABC-DEF..." value={form.token} onChange={(e) => setForm({ ...form, token: e.target.value })} data-testid="input-bot-token" />
            <p className="text-xs text-muted-foreground">Get your token from @BotFather on Telegram</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="alertChat">Alert Chat ID <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="alertChat" placeholder="-100123456789 or your chat ID" value={form.alertChatId} onChange={(e) => setForm({ ...form, alertChatId: e.target.value })} data-testid="input-alert-chat" />
            <p className="text-xs text-muted-foreground">This bot will send itself error alerts here</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="desc">Description <span className="text-muted-foreground">(optional)</span></Label>
            <Input id="desc" placeholder="What does this bot do?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="input-bot-description" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            disabled={!form.name.trim() || !form.token.trim() || mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-create-bot-submit"
          >
            {mutation.isPending ? 'Adding...' : 'Add & Start'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function BotsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: bots, isLoading } = useQuery({
    queryKey: ['/api/bots'],
    queryFn: api.bots.list,
    refetchInterval: 10_000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['/api/bots'] });

  const startMutation = useMutation({
    mutationFn: (id: string) => api.bots.start(id),
    onSuccess: () => { toast({ title: 'Bot started' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const stopMutation = useMutation({
    mutationFn: (id: string) => api.bots.stop(id),
    onSuccess: () => { toast({ title: 'Bot stopped' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const restartMutation = useMutation({
    mutationFn: (id: string) => api.bots.restart(id),
    onSuccess: () => { toast({ title: 'Bot restarted' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.bots.delete(id),
    onSuccess: () => { toast({ title: 'Bot removed' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Bots</h1>
          <p className="text-sm text-muted-foreground">{bots?.length ?? 0} registered</p>
        </div>
        <AddBotDialog onCreated={invalidate} />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="pt-5"><Skeleton className="h-40 w-full" /></CardContent></Card>
          ))}
        </div>
      ) : bots?.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-muted-foreground text-sm">No bots yet. Click "Add Bot" to register your first bot.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {bots?.map((bot) => (
            <BotCard
              key={bot.id}
              bot={bot}
              onStart={() => startMutation.mutate(bot.id)}
              onStop={() => stopMutation.mutate(bot.id)}
              onRestart={() => restartMutation.mutate(bot.id)}
              onDelete={() => {
                if (confirm(`Delete bot "${bot.name}"? This removes all its logs.`)) {
                  deleteMutation.mutate(bot.id);
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
