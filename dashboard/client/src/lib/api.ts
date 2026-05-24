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
};
