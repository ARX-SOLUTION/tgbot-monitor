// In production (publish_website), __PORT_3000__ is replaced with the proxy path.
// In dev, it starts with "__" so falls back to same-origin (empty string).
const BASE = "__PORT_3000__".startsWith("__") 
  ? (import.meta.env.VITE_API_URL || '') 
  : "__PORT_3000__";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

// ── Bot types ─────────────────────────────────────────────────────────────────
export interface BotRuntime {
  isRunning: boolean;
  startedAt: string | null;
  errorCount: number;
  lastError: string | null;
}

export interface Bot {
  id: string;
  name: string;
  token: string;
  alertChatId: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  totalMessages: number;
  totalUsers: number;
  lastActivityAt: number | null;
  runtime?: BotRuntime;
}

export interface UpdateLog {
  id: number;
  botId: string;
  updateId: number;
  updateType: string;
  userId: number | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  chatId: number | null;
  chatType: string | null;
  chatTitle: string | null;
  messageText: string | null;
  rawUpdate: string;
  receivedAt: number;
  isBot: boolean;
  languageCode: string | null;
  fileType: string | null;
  callbackData: string | null;
}

export interface ErrorLog {
  id: number;
  botId: string | null;
  level: string;
  message: string;
  stack: string | null;
  context: string | null;
  createdAt: number;
}

export interface Overview {
  totalBots: number;
  activeBots: number;
  totalMessages: number;
  totalUsers: number;
  totalErrors: number;
  messages24h: number;
}

// ── Ops types ────────────────────────────────────────────────────────────────
export interface KnownChat {
  id: number;
  botId: string;
  chatId: number;
  chatType: string;
  title: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  lastMessageAt: number | null;
  lastMessageId?: number | null;
  lastUpdateId: number | null;
  canSend: boolean;
  isBlocked: boolean;
  tags: string | null;
  permissionsJson?: string | null;
  permissionsCheckedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface PermissionScanResult {
  isAdmin: boolean;
  adminStatus: string;
  canSendMessages: boolean;
  canSendMedia: boolean;
  canDeleteMessages: boolean;
  canPinMessages: boolean;
  canInviteUsers: boolean;
  canRestrictMembers: boolean;
  canPromoteMembers: boolean;
  canChangeInfo: boolean;
  admins: Array<{ userId: number; status: string; username: string | null }>;
}

export interface MediaAsset {
  id: number;
  botId: string;
  fileType: string;
  fileId: string;
  fileUniqueId: string;
  fileName: string | null;
  mimeType: string | null;
  fileSize: number | null;
  title: string | null;
  createdAt: number;
}

export interface BroadcastPreviewResult {
  totalTargets: number;
  sample: KnownChat[];
  excludedBlocked: number;
  excludedCannotSend: number;
}

export interface OutboundMessage {
  id: number;
  botId: string;
  targetChatId: string;
  targetType: string;
  messageType: string;
  text: string | null;
  mediaFileId: string | null;
  mediaUrl: string | null;
  caption: string | null;
  replyToMessageId: number | null;
  telegramMessageId: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: number;
  sentAt: number | null;
}

export interface BroadcastJob {
  id: number;
  botId: string | null;
  title: string;
  messageType: string;
  payloadJson: string;
  filtersJson: string | null;
  status: string;
  totalTargets: number;
  successCount: number;
  failedCount: number;
  createdBy: string | null;
  createdAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  targets?: BroadcastTarget[];
}

export interface BroadcastTarget {
  id: number;
  jobId: number;
  botId: string | null;
  chatId: number;
  status: string;
  telegramMessageId: number | null;
  errorMessage: string | null;
  sentAt: number | null;
}

export interface AuditLog {
  id: number;
  botId: string | null;
  actor: string | null;
  action: string;
  targetChatId: string | null;
  targetUserId: number | null;
  payloadJson: string | null;
  resultJson: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: number;
}

export interface SendMessagePayload {
  botId: string;
  chatId: string;
  type: string;
  text?: string;
  caption?: string;
  mediaFileId?: string;
  mediaUrl?: string;
  messageId?: number;
  replyToMessageId?: number;
  parseMode?: string;
}

export interface BroadcastPayload {
  botId?: string;
  title: string;
  messageType: string;
  text?: string;
  caption?: string;
  mediaFileId?: string;
  mediaUrl?: string;
  filtersJson?: string;
}

export interface RegisterMediaDto {
  botId: string;
  fileType: string;
  fileId: string;
  fileUniqueId?: string;
  fileName?: string;
  mimeType?: string;
  fileSize?: number;
  title?: string;
}

export interface AdminActionPayload {
  botId: string;
  chatId: string;
  action: string;
  payload?: Record<string, any>;
  confirm?: boolean;
  reason?: string;
}

export interface HourlyStat {
  id: number;
  botId: string;
  hour: number;
  messageCount: number;
  uniqueUsers: number;
  callbackCount: number;
  errorCount: number;
}

// ── API calls ─────────────────────────────────────────────────────────────────
export const api = {
  bots: {
    list: () => apiFetch<Bot[]>('/api/bots'),
    get: (id: string) => apiFetch<Bot>(`/api/bots/${id}`),
    create: (data: { name: string; token: string; alertChatId?: string; description?: string }) =>
      apiFetch<Bot>('/api/bots', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Bot>) =>
      apiFetch<Bot>(`/api/bots/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id: string) =>
      apiFetch<void>(`/api/bots/${id}`, { method: 'DELETE' }),
    start: (id: string) =>
      apiFetch<any>(`/api/bots/${id}/start`, { method: 'POST' }),
    stop: (id: string) =>
      apiFetch<any>(`/api/bots/${id}/stop`, { method: 'POST' }),
    restart: (id: string) =>
      apiFetch<any>(`/api/bots/${id}/restart`, { method: 'POST' }),
  },
  logs: {
    updates: (params: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: UpdateLog[]; total: number }>(`/api/logs/updates?${qs}`);
    },
    errors: (botId?: string, limit = 50, offset = 0) => {
      const qs = new URLSearchParams(
        Object.entries({ ...(botId ? { botId } : {}), limit, offset })
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: ErrorLog[]; total: number }>(`/api/logs/errors?${qs}`);
    },
    hourly: (botId: string, from?: number, to?: number) => {
      const qs = new URLSearchParams(
        Object.entries({ ...(from ? { from } : {}), ...(to ? { to } : {}) })
          .map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<HourlyStat[]>(`/api/logs/bots/${botId}/stats/hourly?${qs}`);
    },
    topUsers: (botId: string, limit = 10) =>
      apiFetch<any[]>(`/api/logs/bots/${botId}/users/top?limit=${limit}`),
    typeStats: (botId: string) =>
      apiFetch<{ updateType: string; count: number }[]>(`/api/logs/bots/${botId}/stats/types`),
  },
  stats: {
    overview: () => apiFetch<Overview>('/api/stats/overview'),
    bot: (botId: string) => apiFetch<any>(`/api/stats/bots/${botId}`),
    activity: (limit = 20) => apiFetch<UpdateLog[]>(`/api/stats/activity?limit=${limit}`),
    messageRate: (hours = 24) => apiFetch<any[]>(`/api/stats/message-rate?hours=${hours}`),
  },
  alerts: {
    test: (token: string, chatId: string, message: string) =>
      apiFetch<{ success: boolean }>('/api/alerts/test', {
        method: 'POST',
        body: JSON.stringify({ token, chatId, message }),
      }),
  },
  ops: {
    chats: (params?: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: KnownChat[]; total: number }>(`/api/ops/chats?${qs}`);
    },
    getChat: (chatId: number) => apiFetch<KnownChat>(`/api/ops/chats/${chatId}`),
    refreshChat: (chatId: number) => apiFetch<KnownChat>(`/api/ops/chats/${chatId}/refresh`, { method: 'POST' }),
    scanPermissions: (chatId: number) => apiFetch<PermissionScanResult>(`/api/ops/chats/${chatId}/scan-permissions`, { method: 'POST' }),
    sendMessage: (payload: SendMessagePayload) =>
      apiFetch<any>('/api/ops/messages/send', { method: 'POST', body: JSON.stringify(payload) }),
    replyMessage: (payload: SendMessagePayload) =>
      apiFetch<any>('/api/ops/messages/reply', { method: 'POST', body: JSON.stringify(payload) }),
    registerMedia: (payload: RegisterMediaDto) =>
      apiFetch<MediaAsset>('/api/ops/media/register', { method: 'POST', body: JSON.stringify(payload) }),
    media: (params?: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: MediaAsset[]; total: number }>(`/api/ops/media?${qs}`);
    },
    previewBroadcastTargets: (payload: Record<string, any>) =>
      apiFetch<BroadcastPreviewResult>('/api/ops/broadcasts/preview-targets', { method: 'POST', body: JSON.stringify(payload) }),
    createBroadcast: (payload: BroadcastPayload) =>
      apiFetch<BroadcastJob>('/api/ops/broadcasts', { method: 'POST', body: JSON.stringify(payload) }),
    startBroadcast: (id: number) =>
      apiFetch<any>(`/api/ops/broadcasts/${id}/start`, { method: 'POST' }),
    cancelBroadcast: (id: number) =>
      apiFetch<any>(`/api/ops/broadcasts/${id}/cancel`, { method: 'POST' }),
    broadcasts: (params?: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: BroadcastJob[]; total: number }>(`/api/ops/broadcasts?${qs}`);
    },
    getBroadcast: (id: number) => apiFetch<BroadcastJob>(`/api/ops/broadcasts/${id}`),
    adminAction: (payload: AdminActionPayload) =>
      apiFetch<any>('/api/ops/admin/chat-action', { method: 'POST', body: JSON.stringify(payload) }),
    outbound: (params?: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: OutboundMessage[]; total: number }>(`/api/ops/outbound?${qs}`);
    },
    audit: (params?: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])
      ).toString();
      return apiFetch<{ data: AuditLog[]; total: number }>(`/api/ops/audit?${qs}`);
    },
  },
};
