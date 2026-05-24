import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';
import * as path from 'path';
import * as fs from 'fs';

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private sqlite: any;
  public db: DrizzleDB;

  constructor() {
    // data.db at project root — required for persistence across redeployments
    const dataDir = process.env.DATA_DIR || process.cwd();
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const dbFile = process.env.DB_FILE || 'data.db';
    const dbPath = path.join(dataDir, dbFile);
    this.logger.log(`Database path: ${dbPath}`);

    this.sqlite = new Database(dbPath);
    // Performance tuning
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('synchronous = NORMAL');
    this.sqlite.pragma('cache_size = -64000'); // 64MB
    this.sqlite.pragma('foreign_keys = ON');
    this.sqlite.pragma('temp_store = MEMORY');

    this.db = drizzle(this.sqlite, { schema });
  }

  async migrate() {
    this.logger.log('Running database migrations...');
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        token TEXT NOT NULL UNIQUE,
        alert_chat_id TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        description TEXT,
        webhook_url TEXT,
        total_messages INTEGER NOT NULL DEFAULT 0,
        total_users INTEGER NOT NULL DEFAULT 0,
        last_activity_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS update_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        update_id INTEGER NOT NULL,
        update_type TEXT NOT NULL,
        user_id INTEGER,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        chat_id INTEGER,
        chat_type TEXT,
        chat_title TEXT,
        message_text TEXT,
        raw_update TEXT NOT NULL,
        received_at INTEGER NOT NULL,
        is_bot INTEGER NOT NULL DEFAULT 0,
        language_code TEXT,
        file_type TEXT,
        callback_data TEXT,
        inline_query TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_update_logs_bot_id ON update_logs(bot_id);
      CREATE INDEX IF NOT EXISTS idx_update_logs_received_at ON update_logs(received_at DESC);
      CREATE INDEX IF NOT EXISTS idx_update_logs_user_id ON update_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_update_logs_update_type ON update_logs(update_type);

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        language_code TEXT,
        is_bot INTEGER NOT NULL DEFAULT 0,
        first_seen_at INTEGER NOT NULL,
        last_seen_at INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS bot_user_activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        first_message_at INTEGER NOT NULL,
        last_message_at INTEGER NOT NULL,
        UNIQUE(bot_id, user_id)
      );

      CREATE INDEX IF NOT EXISTS idx_bua_bot_id ON bot_user_activity(bot_id);

      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT REFERENCES bots(id) ON DELETE CASCADE,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        stack TEXT,
        context TEXT,
        alert_sent INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_error_logs_bot_id ON error_logs(bot_id);
      CREATE INDEX IF NOT EXISTS idx_error_logs_created_at ON error_logs(created_at DESC);

      CREATE TABLE IF NOT EXISTS hourly_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        hour INTEGER NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 0,
        unique_users INTEGER NOT NULL DEFAULT 0,
        callback_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        UNIQUE(bot_id, hour)
      );

      CREATE INDEX IF NOT EXISTS idx_hourly_stats_bot_id ON hourly_stats(bot_id);
      CREATE INDEX IF NOT EXISTS idx_hourly_stats_hour ON hourly_stats(hour DESC);

      CREATE TABLE IF NOT EXISTS known_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        chat_id INTEGER NOT NULL,
        chat_type TEXT NOT NULL DEFAULT 'private',
        title TEXT,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        last_message_at INTEGER,
        last_update_id INTEGER,
        can_send INTEGER NOT NULL DEFAULT 1,
        is_blocked INTEGER NOT NULL DEFAULT 0,
        tags TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE UNIQUE INDEX IF NOT EXISTS idx_known_chats_bot_chat ON known_chats(bot_id, chat_id);
      CREATE INDEX IF NOT EXISTS idx_known_chats_bot_id ON known_chats(bot_id);
      CREATE INDEX IF NOT EXISTS idx_known_chats_chat_type ON known_chats(chat_type);
      CREATE INDEX IF NOT EXISTS idx_known_chats_can_send ON known_chats(can_send);
      CREATE INDEX IF NOT EXISTS idx_known_chats_is_blocked ON known_chats(is_blocked);

      CREATE TABLE IF NOT EXISTS media_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        file_type TEXT NOT NULL,
        file_id TEXT NOT NULL,
        file_unique_id TEXT NOT NULL,
        file_name TEXT,
        mime_type TEXT,
        file_size INTEGER,
        title TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_media_assets_bot_id ON media_assets(bot_id);

      CREATE TABLE IF NOT EXISTS outbound_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
        target_chat_id TEXT NOT NULL,
        target_type TEXT NOT NULL DEFAULT 'private',
        message_type TEXT NOT NULL DEFAULT 'text',
        text TEXT,
        media_file_id TEXT,
        media_url TEXT,
        caption TEXT,
        reply_to_message_id INTEGER,
        telegram_message_id INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        error_message TEXT,
        created_at INTEGER NOT NULL,
        sent_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_outbound_messages_bot_id ON outbound_messages(bot_id);
      CREATE INDEX IF NOT EXISTS idx_outbound_messages_status ON outbound_messages(status);
      CREATE INDEX IF NOT EXISTS idx_outbound_messages_created_at ON outbound_messages(created_at DESC);

      CREATE TABLE IF NOT EXISTS broadcast_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT,
        title TEXT NOT NULL,
        message_type TEXT NOT NULL DEFAULT 'text',
        payload_json TEXT NOT NULL,
        filters_json TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        total_targets INTEGER NOT NULL DEFAULT 0,
        success_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        created_by TEXT,
        created_at INTEGER NOT NULL,
        started_at INTEGER,
        finished_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_status ON broadcast_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_broadcast_jobs_created_at ON broadcast_jobs(created_at DESC);

      CREATE TABLE IF NOT EXISTS broadcast_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL REFERENCES broadcast_jobs(id) ON DELETE CASCADE,
        bot_id TEXT,
        chat_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        telegram_message_id INTEGER,
        error_message TEXT,
        sent_at INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_broadcast_targets_job_id ON broadcast_targets(job_id);
      CREATE INDEX IF NOT EXISTS idx_broadcast_targets_status ON broadcast_targets(status);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bot_id TEXT,
        actor TEXT,
        action TEXT NOT NULL,
        target_chat_id TEXT,
        target_user_id INTEGER,
        payload_json TEXT,
        result_json TEXT,
        status TEXT NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_audit_logs_bot_id ON audit_logs(bot_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_status ON audit_logs(status);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
    `);
    this.logger.log('Migrations complete');
  }

  onModuleDestroy() {
    if (this.sqlite) {
      this.sqlite.close();
      this.logger.log('Database connection closed');
    }
  }
}
