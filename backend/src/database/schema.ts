import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Registered Bots ────────────────────────────────────────────────────────
export const bots = sqliteTable('bots', {
  id: text('id').primaryKey(),                // UUID
  name: text('name').notNull(),
  token: text('token').notNull().unique(),
  alertChatId: text('alert_chat_id'),         // Telegram chat to send alerts
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(), // Unix ms
  updatedAt: integer('updated_at').notNull(),
  description: text('description'),
  webhookUrl: text('webhook_url'),
  totalMessages: integer('total_messages').notNull().default(0),
  totalUsers: integer('total_users').notNull().default(0),
  lastActivityAt: integer('last_activity_at'),
});

// ─── Raw Update Logs (every single Telegram update) ─────────────────────────
export const updateLogs = sqliteTable('update_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  updateId: integer('update_id').notNull(),
  updateType: text('update_type').notNull(), // message | callback_query | inline_query | ...
  userId: integer('user_id'),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  chatId: integer('chat_id'),
  chatType: text('chat_type'),               // private | group | supergroup | channel
  chatTitle: text('chat_title'),
  messageText: text('message_text'),
  rawUpdate: text('raw_update').notNull(),    // Full JSON
  receivedAt: integer('received_at').notNull(), // Unix ms
  isBot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
  languageCode: text('language_code'),
  fileType: text('file_type'),               // photo | document | video | sticker | ...
  callbackData: text('callback_data'),
  inlineQuery: text('inline_query'),
});

// ─── Known Users (deduplicated across all bots) ─────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey(),             // Telegram user_id (unique)
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  languageCode: text('language_code'),
  isBot: integer('is_bot', { mode: 'boolean' }).notNull().default(false),
  firstSeenAt: integer('first_seen_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  messageCount: integer('message_count').notNull().default(0),
});

// ─── Per-bot user activity ───────────────────────────────────────────────────
export const botUserActivity = sqliteTable('bot_user_activity', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull(),
  messageCount: integer('message_count').notNull().default(0),
  firstMessageAt: integer('first_message_at').notNull(),
  lastMessageAt: integer('last_message_at').notNull(),
});

// ─── Error / Alert Log ───────────────────────────────────────────────────────
export const errorLogs = sqliteTable('error_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').references(() => bots.id, { onDelete: 'cascade' }),
  level: text('level').notNull(),            // error | warn | info
  message: text('message').notNull(),
  stack: text('stack'),
  context: text('context'),                  // JSON extra info
  alertSent: integer('alert_sent', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at').notNull(),
});

// ─── Hourly Stats (pre-aggregated for dashboard) ─────────────────────────────
export const hourlyStats = sqliteTable('hourly_stats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  hour: integer('hour').notNull(),           // Unix ms, rounded to hour
  messageCount: integer('message_count').notNull().default(0),
  uniqueUsers: integer('unique_users').notNull().default(0),
  callbackCount: integer('callback_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
});

// ─── Types ───────────────────────────────────────────────────────────────────
export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
export type UpdateLog = typeof updateLogs.$inferSelect;
export type InsertUpdateLog = typeof updateLogs.$inferInsert;
export type User = typeof users.$inferSelect;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type HourlyStats = typeof hourlyStats.$inferSelect;
