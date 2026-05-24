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
