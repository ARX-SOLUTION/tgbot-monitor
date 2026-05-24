# TGBot Monitor — Multi-Bot Telegram Logging & Dashboard

NestJS + Telegraf + SQLite + React dashboard — monitor up to 20+ Telegram bots in one place.

## Architecture

```
tgbot-monitor/
├── backend/                  # NestJS API server
│   ├── src/
│   │   ├── bots/             # Bot CRUD + BotRegistryService (dynamic Telegraf instances)
│   │   ├── logs/             # Update logs, error logs, hourly stats
│   │   ├── stats/            # Aggregated analytics
│   │   ├── alerts/           # Telegram alert sender
│   │   ├── database/         # Drizzle ORM + SQLite (WAL mode)
│   │   └── common/           # Exception filter, pipes
│   └── dist/                 # Compiled output
├── dashboard/                # React + Vite + Tailwind frontend
│   └── dist/                 # Built static files (served by NestJS at /dashboard)
├── data/                     # SQLite DB files (created at runtime)
├── logs/                     # PM2 log output
└── ecosystem.config.js       # PM2 config
```

## Quick Start

### 1. Install dependencies
```bash
make install
# or manually:
cd backend && npm install
cd dashboard && npm install
```

### 2. Configure environment
```bash
cp backend/.env.example backend/.env
# Edit backend/.env — set PORT, optional ALERT_BOT_TOKEN, ALERT_CHAT_ID
```

### 3. Build
```bash
make build
# or:
cd backend && npx nest build
cd dashboard && npm run build
```

### 4. Run with PM2
```bash
# Install PM2 globally (once)
npm install -g pm2

# Start the server
make start
# or:
pm2 start ecosystem.config.js --env production

# Auto-start on reboot
pm2 save
pm2 startup
```

### 5. Open dashboard
```
http://localhost:3000/dashboard
```

### 6. API docs (Swagger)
```
http://localhost:3000/api/docs
```

---

## Adding a Bot

### Via Dashboard
1. Go to **Bots** page → click **Add Bot**
2. Enter name, token (from @BotFather), optional alert chat ID
3. Click **Add & Start** — the bot starts immediately

### Via API
```bash
curl -X POST http://localhost:3000/api/bots \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "My Bot",
    "token": "123456:ABC...",
    "alertChatId": "-100123456789",
    "description": "Customer support bot"
  }'
```

---

## What Gets Logged

Every single Telegram update is captured automatically:

| Field | Description |
|-------|-------------|
| `update_type` | message, callback_query, inline_query, edited_message, channel_post, poll, my_chat_member, ... |
| `user_id` | Telegram user ID |
| `username` | @username |
| `first_name` / `last_name` | User name |
| `chat_id` / `chat_type` | Private, group, supergroup, channel |
| `message_text` | Text content |
| `file_type` | photo, video, document, sticker, voice, ... |
| `callback_data` | Inline keyboard callback data |
| `raw_update` | Full JSON of the Telegram update |
| `received_at` | Unix timestamp (ms) |

---

## Telegram Alerts

Each bot can send alerts to a Telegram chat when:
- An unhandled exception occurs in the bot handler
- The bot process crashes and cannot reconnect
- The bot is started or stopped manually

Set `alertChatId` per-bot (the bot sends alerts to that chat using its own token).

For system-wide alerts (server errors), set in `.env`:
```
ALERT_BOT_TOKEN=<your-admin-bot-token>
ALERT_CHAT_ID=<your-chat-id>
```

**Finding your chat ID:** Send `/start` to your bot, then visit:
`https://api.telegram.org/bot<TOKEN>/getUpdates`

---

## PM2 Commands

```bash
pm2 status                          # show all processes
pm2 logs tgbot-monitor              # live logs
pm2 logs tgbot-monitor --lines 200  # last 200 lines
pm2 reload tgbot-monitor            # zero-downtime reload (after code update)
pm2 restart tgbot-monitor           # hard restart
pm2 stop tgbot-monitor              # stop without removing
pm2 monit                           # CPU/memory dashboard
pm2 plus                            # PM2 cloud monitoring (optional)

# Install log rotation (recommended)
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 50M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bots` | List all bots with runtime status |
| POST | `/api/bots` | Register a new bot |
| GET | `/api/bots/:id` | Get bot details |
| PUT | `/api/bots/:id` | Update bot config |
| DELETE | `/api/bots/:id` | Remove bot + all its logs |
| POST | `/api/bots/:id/start` | Start a stopped bot |
| POST | `/api/bots/:id/stop` | Stop a running bot |
| POST | `/api/bots/:id/restart` | Restart a bot |
| GET | `/api/logs/updates` | Paginated update logs (filters: botId, userId, updateType, search, from, to) |
| GET | `/api/logs/errors` | Error / system logs |
| GET | `/api/logs/bots/:id/stats/hourly` | Hourly message stats |
| GET | `/api/logs/bots/:id/users/top` | Top users by message count |
| GET | `/api/logs/bots/:id/stats/types` | Update type distribution |
| GET | `/api/stats/overview` | Global overview (all bots) |
| GET | `/api/stats/bots/:id` | Per-bot 24h/7d summary |
| GET | `/api/stats/activity` | Recent activity feed |
| GET | `/api/stats/message-rate` | Messages/hour per bot |
| POST | `/api/alerts/test` | Send a test alert |
| GET | `/api/docs` | Swagger UI |

---

## Database Schema

```
bots              — registered bots
update_logs       — every Telegram update (indexed by botId, userId, receivedAt)
users             — deduplicated user registry
bot_user_activity — per-bot user message counts
error_logs        — errors, warnings, info events
hourly_stats      — pre-aggregated hourly metrics (fast dashboard queries)
```

SQLite is run in WAL mode with a 64MB page cache for high-throughput write performance.

---

## Development

```bash
# Backend dev (hot-reload)
cd backend && npx nest start --watch

# Dashboard dev server
cd dashboard && npm run dev

# Backend runs on :3000, dashboard dev on :5173
# Set VITE_API_URL=http://localhost:3000 in dashboard dev
```

---

## Scaling Notes

- **SQLite WAL mode** handles concurrent reads well; for very high write volume (50+ bots × 1000 msgs/min), consider migrating to PostgreSQL with the same Drizzle schema.
- **PM2 fork mode** (default): safe for SQLite — only 1 process writes to DB.
- **PM2 cluster mode**: switch `exec_mode: 'cluster'` only after moving to PostgreSQL or adding a Redis session store.
- **Webhook mode**: for production with many bots, switch from long-polling to webhook by setting `webhookUrl` per bot and calling `bot.telegram.setWebhook(url)` in `BotRegistryService.startBot()`.
