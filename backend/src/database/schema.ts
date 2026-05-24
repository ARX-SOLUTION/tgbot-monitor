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

// ─── Known Chats ─────────────────────────────────────────────────────────────
export const knownChats = sqliteTable('known_chats', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  chatId: integer('chat_id').notNull(),
  chatType: text('chat_type').notNull().default('private'),
  title: text('title'),
  username: text('username'),
  firstName: text('first_name'),
  lastName: text('last_name'),
  lastMessageAt: integer('last_message_at'),
  lastMessageId: integer('last_message_id'),
  lastUpdateId: integer('last_update_id'),
  canSend: integer('can_send', { mode: 'boolean' }).notNull().default(true),
  isBlocked: integer('is_blocked', { mode: 'boolean' }).notNull().default(false),
  tags: text('tags'),
  permissionsJson: text('permissions_json'),
  permissionsCheckedAt: integer('permissions_checked_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

// ─── Media Assets ───────────────────────────────────────────────────────────
export const mediaAssets = sqliteTable('media_assets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  fileType: text('file_type').notNull(),
  fileId: text('file_id').notNull(),
  fileUniqueId: text('file_unique_id').notNull(),
  fileName: text('file_name'),
  mimeType: text('mime_type'),
  fileSize: integer('file_size'),
  title: text('title'),
  createdAt: integer('created_at').notNull(),
});

// ─── Outbound Messages ──────────────────────────────────────────────────────
export const outboundMessages = sqliteTable('outbound_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id').notNull().references(() => bots.id, { onDelete: 'cascade' }),
  targetChatId: text('target_chat_id').notNull(),
  targetType: text('target_type').notNull().default('private'),
  messageType: text('message_type').notNull().default('text'),
  text: text('text'),
  mediaFileId: text('media_file_id'),
  mediaUrl: text('media_url'),
  caption: text('caption'),
  replyToMessageId: integer('reply_to_message_id'),
  telegramMessageId: integer('telegram_message_id'),
  status: text('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull(),
  sentAt: integer('sent_at'),
});

// ─── Broadcast Jobs ─────────────────────────────────────────────────────────
export const broadcastJobs = sqliteTable('broadcast_jobs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id'),
  title: text('title').notNull(),
  messageType: text('message_type').notNull().default('text'),
  payloadJson: text('payload_json').notNull(),
  filtersJson: text('filters_json'),
  status: text('status').notNull().default('pending'),
  totalTargets: integer('total_targets').notNull().default(0),
  successCount: integer('success_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  finishedAt: integer('finished_at'),
});

// ─── Broadcast Targets ──────────────────────────────────────────────────────
export const broadcastTargets = sqliteTable('broadcast_targets', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobId: integer('job_id').notNull().references(() => broadcastJobs.id, { onDelete: 'cascade' }),
  botId: text('bot_id'),
  chatId: integer('chat_id').notNull(),
  status: text('status').notNull().default('pending'),
  telegramMessageId: integer('telegram_message_id'),
  errorMessage: text('error_message'),
  sentAt: integer('sent_at'),
});

// ─── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  botId: text('bot_id'),
  actor: text('actor'),
  action: text('action').notNull(),
  targetChatId: text('target_chat_id'),
  targetUserId: integer('target_user_id'),
  payloadJson: text('payload_json'),
  resultJson: text('result_json'),
  status: text('status').notNull().default('success'),
  errorMessage: text('error_message'),
  createdAt: integer('created_at').notNull(),
});

// ─── Types ───────────────────────────────────────────────────────────────────
export type Bot = typeof bots.$inferSelect;
export type InsertBot = typeof bots.$inferInsert;
export type UpdateLog = typeof updateLogs.$inferSelect;
export type InsertUpdateLog = typeof updateLogs.$inferInsert;
export type User = typeof users.$inferSelect;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type HourlyStats = typeof hourlyStats.$inferSelect;
export type KnownChat = typeof knownChats.$inferSelect;
export type InsertKnownChat = typeof knownChats.$inferInsert;
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;
export type OutboundMessage = typeof outboundMessages.$inferSelect;
export type InsertOutboundMessage = typeof outboundMessages.$inferInsert;
export type BroadcastJob = typeof broadcastJobs.$inferSelect;
export type InsertBroadcastJob = typeof broadcastJobs.$inferInsert;
export type BroadcastTarget = typeof broadcastTargets.$inferSelect;
export type InsertBroadcastTarget = typeof broadcastTargets.$inferInsert;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
