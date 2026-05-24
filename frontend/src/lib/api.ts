const BASE = import.meta.env.VITE_API_URL ?? ''

async function req<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const e = await res.json().catch(() => ({}))
    throw new Error(e.message ?? `HTTP ${res.status}`)
  }
  // DELETE returns 204 no content
  if (res.status === 204) return undefined as T
  return res.json()
}

export interface Bot {
  id: string; name: string; token: string
  alertChatId: string | null; description: string | null
  isActive: boolean; createdAt: number; updatedAt: number
  totalMessages: number; totalUsers: number; lastActivityAt: number | null
  runtime?: {
    isRunning: boolean; startedAt: string | null
    errorCount: number; lastError: string | null
  }
}
export interface UpdateLog {
  id: number; botId: string; updateId: number; updateType: string
  userId: number | null; username: string | null; firstName: string | null
  chatId: number | null; chatType: string | null; chatTitle: string | null
  messageText: string | null; rawUpdate: string; receivedAt: number
  isBot: boolean; languageCode: string | null
  fileType: string | null; callbackData: string | null
}
export interface ErrorLog {
  id: number; botId: string | null; level: string; message: string
  stack: string | null; context: string | null; createdAt: number
}
export interface Overview {
  totalBots: number; activeBots: number; totalMessages: number
  totalUsers: number; totalErrors: number; messages24h: number
}

export const api = {
  bots: {
    list:    ()                   => req<Bot[]>('/api/bots'),
    get:     (id: string)         => req<Bot>(`/api/bots/${id}`),
    create:  (d: Partial<Bot>)    => req<Bot>('/api/bots', { method: 'POST', body: JSON.stringify(d) }),
    update:  (id: string, d: any) => req<Bot>(`/api/bots/${id}`, { method: 'PUT', body: JSON.stringify(d) }),
    delete:  (id: string)         => req<void>(`/api/bots/${id}`, { method: 'DELETE' }),
    start:   (id: string)         => req<any>(`/api/bots/${id}/start`, { method: 'POST' }),
    stop:    (id: string)         => req<any>(`/api/bots/${id}/stop`, { method: 'POST' }),
    restart: (id: string)         => req<any>(`/api/bots/${id}/restart`, { method: 'POST' }),
  },
  logs: {
    updates: (p: Record<string, any>) => {
      const qs = new URLSearchParams(
        Object.entries(p)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => [k, String(v)])
      ).toString()
      return req<{ data: UpdateLog[]; total: number }>(`/api/logs/updates?${qs}`)
    },
    errors: (botId?: string, limit = 50, offset = 0) => {
      const qs = new URLSearchParams(
        Object.entries({ ...(botId ? { botId } : {}), limit, offset }).map(([k, v]) => [k, String(v)])
      ).toString()
      return req<{ data: ErrorLog[]; total: number }>(`/api/logs/errors?${qs}`)
    },
    hourly:   (botId: string, from: number, to: number) =>
      req<any[]>(`/api/logs/bots/${botId}/stats/hourly?from=${from}&to=${to}`),
    topUsers: (botId: string, limit = 10) =>
      req<any[]>(`/api/logs/bots/${botId}/users/top?limit=${limit}`),
    typeStats: (botId: string) =>
      req<{ updateType: string; count: number }[]>(`/api/logs/bots/${botId}/stats/types`),
  },
  stats: {
    overview:    ()          => req<Overview>('/api/stats/overview'),
    bot:         (id: string) => req<any>(`/api/stats/bots/${id}`),
    activity:    (limit = 20) => req<UpdateLog[]>(`/api/stats/activity?limit=${limit}`),
    messageRate: (hours = 24) => req<any[]>(`/api/stats/message-rate?hours=${hours}`),
  },
  alerts: {
    test: (token: string, chatId: string, message: string) =>
      req<{ success: boolean }>('/api/alerts/test', {
        method: 'POST', body: JSON.stringify({ token, chatId, message }),
      }),
  },
}
