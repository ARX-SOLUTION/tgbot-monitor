import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, Bot, KnownChat, BroadcastJob, AuditLog, SendMessagePayload, BroadcastPayload, AdminActionPayload } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { Search, Send, Reply, Radio, MessageSquare, Users, Shield, List } from 'lucide-react';

const PAGE_SIZE = 50;

const CHAT_TYPES = ['private', 'group', 'supergroup', 'channel'];
const MESSAGE_TYPES = ['text', 'photo', 'video', 'animation', 'audio', 'voice', 'document'];
const ADMIN_ACTIONS = [
  'getChat', 'getChatAdministrators', 'banChatMember', 'unbanChatMember',
  'restrictChatMember', 'promoteChatMember', 'setChatTitle', 'setChatDescription',
  'pinChatMessage', 'unpinChatMessage', 'deleteMessage', 'createChatInviteLink',
];

export default function OperationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('inbox');

  const { data: bots } = useQuery({ queryKey: ['/api/bots'], queryFn: api.bots.list });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Operations Center</h1>
          <p className="text-sm text-muted-foreground">Send messages, manage broadcasts, and control groups</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="inbox"><MessageSquare className="w-4 h-4 mr-1.5" />Inbox</TabsTrigger>
          <TabsTrigger value="send"><Send className="w-4 h-4 mr-1.5" />Send</TabsTrigger>
          <TabsTrigger value="broadcasts"><Radio className="w-4 h-4 mr-1.5" />Broadcasts</TabsTrigger>
          <TabsTrigger value="groups"><Users className="w-4 h-4 mr-1.5" />Groups</TabsTrigger>
          <TabsTrigger value="audit"><Shield className="w-4 h-4 mr-1.5" />Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <InboxTab bots={bots} />
        </TabsContent>
        <TabsContent value="send" className="mt-4">
          <SendTab bots={bots} toast={toast} queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="broadcasts" className="mt-4">
          <BroadcastsTab bots={bots} toast={toast} queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsTab bots={bots} toast={toast} queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="audit" className="mt-4">
          <AuditTab />
        </TabsContent>
      </Tabs>

      <p className="text-xs text-muted-foreground mt-2">
        Bot can send only to chats/users it has access to. Group/channel actions require bot admin rights.
      </p>
    </div>
  );
}

function InboxTab({ bots }: { bots?: Bot[] }) {
  const [botId, setBotId] = useState('');
  const [chatType, setChatType] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/ops/chats', botId, chatType, search],
    queryFn: () => api.ops.chats({ botId: botId || undefined, chatType: chatType || undefined, search: search || undefined, limit: 100 }),
    refetchInterval: 15_000,
  });

  const botMap = Object.fromEntries((bots ?? []).map((b) => [b.id, b.name]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Select value={botId || 'all'} onValueChange={(v) => setBotId(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All bots" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bots</SelectItem>
              {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={chatType || 'all'} onValueChange={(v) => setChatType(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Chat type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {CHAT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Bot', 'Name', 'Type', 'Chat ID', 'Last Message', 'Status'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : data?.data.map((chat) => (
                <tr key={chat.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-2 text-xs">{botMap[chat.botId] ?? chat.botId.slice(0, 8)}</td>
                  <td className="px-4 py-2 text-xs max-w-[150px] truncate">{chat.title ?? chat.firstName ?? chat.username ?? `#${chat.chatId}`}</td>
                  <td className="px-4 py-2"><Badge variant="outline" className="text-xs capitalize">{chat.chatType}</Badge></td>
                  <td className="px-4 py-2 text-xs font-mono text-muted-foreground">{chat.chatId}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{chat.lastMessageAt ? format(new Date(chat.lastMessageAt), 'MM-dd HH:mm') : '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={chat.isBlocked ? 'destructive' : chat.canSend ? 'default' : 'secondary'} className="text-xs">
                      {chat.isBlocked ? 'blocked' : chat.canSend ? 'active' : 'inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data?.data?.length === 0 && !isLoading && (
          <div className="py-12 text-center text-sm text-muted-foreground">No known chats yet. Chats are discovered from incoming updates.</div>
        )}
      </CardContent>
    </Card>
  );
}

function SendTab({ bots, toast, queryClient }: { bots?: Bot[]; toast: any; queryClient: any }) {
  const [botId, setBotId] = useState('');
  const [chatId, setChatId] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaFileId, setMediaFileId] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [replyToId, setReplyToId] = useState('');
  const [mode, setMode] = useState<'send' | 'reply'>('send');

  const mutation = useMutation({
    mutationFn: () => {
      const payload: SendMessagePayload = {
        botId,
        chatId,
        type: msgType,
        text: text || undefined,
        caption: caption || undefined,
        mediaFileId: mediaFileId || undefined,
        mediaUrl: mediaUrl || undefined,
      };
      if (mode === 'reply' && replyToId) payload.messageId = parseInt(replyToId);
      return mode === 'send' ? api.ops.sendMessage(payload) : api.ops.replyMessage(payload);
    },
    onSuccess: () => {
      toast({ title: 'Message sent', description: 'Message delivered successfully' });
      setText(''); setCaption(''); setMediaFileId(''); setMediaUrl(''); setReplyToId('');
      queryClient.invalidateQueries({ queryKey: ['/api/ops'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Send Message</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant={mode === 'send' ? 'default' : 'outline'} onClick={() => setMode('send')}>
              <Send className="w-3.5 h-3.5 mr-1" /> Direct Send
            </Button>
            <Button size="sm" variant={mode === 'reply' ? 'default' : 'outline'} onClick={() => setMode('reply')}>
              <Reply className="w-3.5 h-3.5 mr-1" /> Reply
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Bot</Label>
            <Select value={botId} onValueChange={setBotId}>
              <SelectTrigger><SelectValue placeholder="Select bot" /></SelectTrigger>
              <SelectContent>
                {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Chat ID</Label>
            <Input placeholder="-100123456789 or @username" value={chatId} onChange={(e) => setChatId(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Message Type</Label>
            <Select value={msgType} onValueChange={setMsgType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MESSAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {mode === 'reply' && (
            <div className="space-y-1.5">
              <Label>Reply to Message ID</Label>
              <Input placeholder="Message ID to reply to" value={replyToId} onChange={(e) => setReplyToId(e.target.value)} />
            </div>
          )}
        </div>

        {msgType === 'text' ? (
          <div className="space-y-1.5">
            <Label>Text</Label>
            <Textarea placeholder="Message text..." value={text} onChange={(e) => setText(e.target.value)} />
          </div>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label>Media File ID <span className="text-muted-foreground">(or URL)</span></Label>
              <Input placeholder="Telegram file_id" value={mediaFileId} onChange={(e) => setMediaFileId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Media URL <span className="text-muted-foreground">(alternative)</span></Label>
              <Input placeholder="https://..." value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Caption</Label>
              <Textarea placeholder="Media caption..." value={caption} onChange={(e) => setCaption(e.target.value)} />
            </div>
          </>
        )}

        <Button onClick={() => mutation.mutate()} disabled={!botId || !chatId || mutation.isPending} className="w-full">
          {mutation.isPending ? 'Sending...' : mode === 'send' ? 'Send Message' : 'Send Reply'}
        </Button>
      </CardContent>
    </Card>
  );
}

function BroadcastsTab({ bots, toast, queryClient }: { bots?: Bot[]; toast: any; queryClient: any }) {
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [botId, setBotId] = useState('');
  const [msgType, setMsgType] = useState('text');
  const [text, setText] = useState('');
  const [caption, setCaption] = useState('');
  const [mediaFileId, setMediaFileId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['/api/ops/broadcasts'],
    queryFn: () => api.ops.broadcasts(),
    refetchInterval: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: () => {
      const payload: BroadcastPayload = {
        title,
        messageType: msgType,
        text: text || undefined,
        caption: caption || undefined,
        mediaFileId: mediaFileId || undefined,
        filtersJson: JSON.stringify({ botId: botId || undefined }),
      };
      if (botId) payload.botId = botId;
      return api.ops.createBroadcast(payload);
    },
    onSuccess: () => {
      toast({ title: 'Broadcast created' });
      setShowCreate(false);
      setTitle(''); setText(''); setCaption(''); setMediaFileId('');
      queryClient.invalidateQueries({ queryKey: ['/api/ops/broadcasts'] });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const startMutation = useMutation({
    mutationFn: (id: number) => api.ops.startBroadcast(id),
    onSuccess: () => { toast({ title: 'Broadcast started!' }); queryClient.invalidateQueries({ queryKey: ['/api/ops/broadcasts'] }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => api.ops.cancelBroadcast(id),
    onSuccess: () => { toast({ title: 'Broadcast cancelled' }); queryClient.invalidateQueries({ queryKey: ['/api/ops/broadcasts'] }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const statusBadge: Record<string, string> = {
    pending: 'secondary',
    running: 'default',
    completed: 'default',
    failed: 'destructive',
    cancelled: 'secondary',
  };

  return (
    <div className="space-y-4">
      {showCreate ? (
        <Card>
          <CardHeader><CardTitle className="text-base">New Broadcast</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title</Label>
                <Input placeholder="Campaign name" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Bot <span className="text-muted-foreground">(optional — all bots)</span></Label>
                <Select value={botId} onValueChange={setBotId}>
                  <SelectTrigger><SelectValue placeholder="All bots" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All bots</SelectItem>
                    {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Message Type</Label>
              <Select value={msgType} onValueChange={setMsgType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MESSAGE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {msgType === 'text' ? (
              <div className="space-y-1.5">
                <Label>Text</Label>
                <Textarea placeholder="Message text..." value={text} onChange={(e) => setText(e.target.value)} />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Media File ID</Label>
                  <Input placeholder="Telegram file_id" value={mediaFileId} onChange={(e) => setMediaFileId(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Caption</Label>
                  <Textarea placeholder="Media caption..." value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </>
            )}
            <div className="flex gap-2">
              <Button onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Broadcast'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setShowCreate(true)}><Radio className="w-4 h-4 mr-1.5" />New Broadcast</Button>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {['Title', 'Type', 'Status', 'Targets', 'Success', 'Failed', 'Created', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-20" /></td>)}
                  </tr>
                )) : data?.data.map((job) => (
                  <tr key={job.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs font-medium max-w-[120px] truncate">{job.title}</td>
                    <td className="px-4 py-2 text-xs">{job.messageType}</td>
                    <td className="px-4 py-2"><Badge variant={(statusBadge[job.status] || 'secondary') as any} className="text-xs">{job.status}</Badge></td>
                    <td className="px-4 py-2 text-xs">{job.totalTargets}</td>
                    <td className="px-4 py-2 text-xs text-green-600">{job.successCount}</td>
                    <td className="px-4 py-2 text-xs text-red-600">{job.failedCount}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{format(new Date(job.createdAt), 'MM-dd HH:mm')}</td>
                    <td className="px-4 py-2">
                      {job.status === 'pending' && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => startMutation.mutate(job.id)}>Start</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => cancelMutation.mutate(job.id)}>Cancel</Button>
                        </div>
                      )}
                      {job.status === 'running' && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => cancelMutation.mutate(job.id)}>Cancel</Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.data?.length === 0 && !isLoading && (
            <div className="py-12 text-center text-sm text-muted-foreground">No broadcast jobs yet.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GroupsTab({ bots, toast, queryClient }: { bots?: Bot[]; toast: any; queryClient: any }) {
  const [botId, setBotId] = useState('');
  const [chatId, setChatId] = useState('');
  const [action, setAction] = useState('getChat');
  const [userId, setUserId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [messageId, setMessageId] = useState('');
  const [result, setResult] = useState<any>(null);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: AdminActionPayload = { botId, chatId, action, payload: {} };
      if (['banChatMember', 'unbanChatMember', 'restrictChatMember', 'promoteChatMember'].includes(action) && userId) {
        payload.payload = { userId: parseInt(userId) };
      }
      if (action === 'setChatTitle' && title) payload.payload = { title };
      if (action === 'setChatDescription' && description) payload.payload = { description };
      if (['pinChatMessage', 'unpinChatMessage', 'deleteMessage'].includes(action) && messageId) {
        payload.payload = { messageId: parseInt(messageId) };
      }
      if (action === 'createChatInviteLink') payload.payload = {};
      return api.ops.adminAction(payload);
    },
    onSuccess: (data) => {
      toast({ title: 'Action executed', description: `${action} completed` });
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ['/api/ops'] });
    },
    onError: (e: any) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Admin Action</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Bot</Label>
              <Select value={botId} onValueChange={setBotId}>
                <SelectTrigger><SelectValue placeholder="Select bot" /></SelectTrigger>
                <SelectContent>{bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Chat ID</Label>
              <Input placeholder="-100..." value={chatId} onChange={(e) => setChatId(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Action</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{ADMIN_ACTIONS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          {['banChatMember', 'unbanChatMember', 'restrictChatMember', 'promoteChatMember'].includes(action) && (
            <div className="space-y-1.5">
              <Label>User ID</Label>
              <Input placeholder="Telegram user ID" value={userId} onChange={(e) => setUserId(e.target.value)} />
            </div>
          )}
          {action === 'setChatTitle' && (
            <div className="space-y-1.5">
              <Label>New Title</Label>
              <Input placeholder="Group name" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
          )}
          {action === 'setChatDescription' && (
            <div className="space-y-1.5">
              <Label>New Description</Label>
              <Input placeholder="Group description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          )}
          {['pinChatMessage', 'unpinChatMessage', 'deleteMessage'].includes(action) && (
            <div className="space-y-1.5">
              <Label>Message ID</Label>
              <Input placeholder="Telegram message ID" value={messageId} onChange={(e) => setMessageId(e.target.value)} />
            </div>
          )}

          <Button onClick={() => mutation.mutate()} disabled={!botId || !chatId || mutation.isPending} className="w-full">
            {mutation.isPending ? 'Executing...' : `Execute ${action}`}
          </Button>

          <p className="text-xs text-muted-foreground">Group/channel actions require the bot to be an admin with the needed permissions.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Result</CardTitle></CardHeader>
        <CardContent>
          {result ? (
            <pre className="text-xs bg-muted p-3 rounded max-h-[300px] overflow-auto whitespace-pre-wrap font-mono">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">Execute an action to see the result.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AuditTab() {
  const [botId, setBotId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(0);

  const { data: bots } = useQuery({ queryKey: ['/api/bots'], queryFn: api.bots.list });

  const { data, isLoading } = useQuery({
    queryKey: ['/api/ops/audit', botId, action, page],
    queryFn: () => api.ops.audit({
      botId: botId || undefined,
      action: action || undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    refetchInterval: 10_000,
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0;
  const botMap = Object.fromEntries((bots ?? []).map((b) => [b.id, b.name]));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Select value={botId || 'all'} onValueChange={(v) => { setBotId(v === 'all' ? '' : v); setPage(0); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All bots" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bots</SelectItem>
              {bots?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            placeholder="Filter action..."
            value={action}
            onChange={(e) => { setAction(e.target.value); setPage(0); }}
            className="w-48"
          />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {['Time', 'Bot', 'Action', 'Target', 'Status', 'Error'].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  {Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-2"><Skeleton className="h-4 w-full" /></td>)}
                </tr>
              )) : data?.data.map((log) => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{format(new Date(log.createdAt), 'MM-dd HH:mm:ss')}</td>
                  <td className="px-4 py-2 text-xs">{botMap[log.botId ?? ''] ?? (log.botId ? log.botId.slice(0, 8) : '—')}</td>
                  <td className="px-4 py-2 text-xs font-medium">{log.action}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{log.targetChatId ?? '—'}</td>
                  <td className="px-4 py-2">
                    <Badge variant={log.status === 'success' ? 'default' : log.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-destructive max-w-[150px] truncate">{log.errorMessage ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <span className="text-xs text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        )}

        {data?.data?.length === 0 && !isLoading && (
          <div className="py-12 text-center text-sm text-muted-foreground">No audit logs yet.</div>
        )}
      </CardContent>
    </Card>
  );
}
