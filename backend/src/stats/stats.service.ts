import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { updateLogs, errorLogs, users, bots, botUserActivity } from '../database/schema';
import { eq, desc, gte, and, count, sql } from 'drizzle-orm';

@Injectable()
export class StatsService {
  constructor(private readonly dbService: DatabaseService) {}

  get db() { return this.dbService.db; }

  // ── Global dashboard overview ─────────────────────────────────────────────
  async getOverview() {
    const totalBotsResult = this.db.select({ count: count() }).from(bots).get();
    const activeBotsResult = this.db
      .select({ count: count() })
      .from(bots)
      .where(eq(bots.isActive, true))
      .get();
    const totalMessagesResult = this.db
      .select({ sum: sql<number>`SUM(total_messages)` })
      .from(bots)
      .get();
    const totalUsersResult = this.db.select({ count: count() }).from(users).get();
    const totalErrorsResult = this.db.select({ count: count() }).from(errorLogs).get();

    const last24h = Date.now() - 86_400_000;
    const messages24hResult = this.db
      .select({ count: count() })
      .from(updateLogs)
      .where(gte(updateLogs.receivedAt, last24h))
      .get();

    return {
      totalBots: totalBotsResult?.count ?? 0,
      activeBots: activeBotsResult?.count ?? 0,
      totalMessages: totalMessagesResult?.sum ?? 0,
      totalUsers: totalUsersResult?.count ?? 0,
      totalErrors: totalErrorsResult?.count ?? 0,
      messages24h: messages24hResult?.count ?? 0,
    };
  }

  // ── Per-bot summary ───────────────────────────────────────────────────────
  async getBotSummary(botId: string) {
    const last24h = Date.now() - 86_400_000;
    const last7d = Date.now() - 7 * 86_400_000;

    const msgs24h = this.db
      .select({ count: count() })
      .from(updateLogs)
      .where(and(eq(updateLogs.botId, botId), gte(updateLogs.receivedAt, last24h)))
      .get();

    const msgs7d = this.db
      .select({ count: count() })
      .from(updateLogs)
      .where(and(eq(updateLogs.botId, botId), gte(updateLogs.receivedAt, last7d)))
      .get();

    const uniqueUsers = this.db
      .select({ count: count() })
      .from(botUserActivity)
      .where(eq(botUserActivity.botId, botId))
      .get();

    const errors24h = this.db
      .select({ count: count() })
      .from(errorLogs)
      .where(and(eq(errorLogs.botId, botId), gte(errorLogs.createdAt, last24h)))
      .get();

    return {
      messages24h: msgs24h?.count ?? 0,
      messages7d: msgs7d?.count ?? 0,
      uniqueUsers: uniqueUsers?.count ?? 0,
      errors24h: errors24h?.count ?? 0,
    };
  }

  // ── Recent activity feed ──────────────────────────────────────────────────
  async getRecentActivity(limit = 20) {
    return this.db
      .select()
      .from(updateLogs)
      .orderBy(desc(updateLogs.receivedAt))
      .limit(limit)
      .all();
  }

  // ── Messages per hour for last N hours ───────────────────────────────────
  async getMessageRate(hours = 24) {
    const since = Date.now() - hours * 3_600_000;
    return this.db
      .select({
        botId: updateLogs.botId,
        hour: sql<number>`(received_at / 3600000) * 3600000`,
        count: count(),
      })
      .from(updateLogs)
      .where(gte(updateLogs.receivedAt, since))
      .groupBy(updateLogs.botId, sql`(received_at / 3600000) * 3600000`)
      .orderBy(sql`(received_at / 3600000) * 3600000`)
      .all();
  }
}
