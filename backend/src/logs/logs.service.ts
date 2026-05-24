import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import {
  updateLogs, errorLogs, users, botUserActivity, hourlyStats,
  knownChats, mediaAssets,
  UpdateLog, ErrorLog, InsertKnownChat, InsertMediaAsset
} from '../database/schema';
import { eq, desc, and, gte, lte, like, sql, count } from 'drizzle-orm';
import { Update } from 'telegraf/types';

export interface LogsFilter {
  botId?: string;
  userId?: number;
  updateType?: string;
  search?: string;
  from?: number;
  to?: number;
  limit?: number;
  offset?: number;
}

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly dbService: DatabaseService) {}

  get db() {
    return this.dbService.db;
  }

  // ── Log a Telegram update ─────────────────────────────────────────────────
  async logUpdate(botId: string, update: Update): Promise<void> {
    const now = Date.now();
    const updateId = (update as any).update_id;
    const updateType = this.detectUpdateType(update);
    const from = this.extractFrom(update);
    const chat = this.extractChat(update);
    const text = this.extractText(update);
    const fileType = this.extractFileType(update);
    const callbackData = (update as any).callback_query?.data ?? null;
    const inlineQuery = (update as any).inline_query?.query ?? null;

   // Upsert known chat if chat info is present
   if (chat && chat.id) {
     await this.upsertKnownChat(botId, chat, now, updateId);
   }

   // Upsert media assets if present
   const mediaInfos = this.extractMediaAssets(update);
   for (const media of mediaInfos) {
     await this.upsertMediaAsset(botId, media, now);
   }

   this.db.insert(updateLogs).values({
      botId,
      updateId,
      updateType,
      userId: from?.id ?? null,
      username: from?.username ?? null,
      firstName: from?.first_name ?? null,
      lastName: from?.last_name ?? null,
      chatId: chat?.id ?? null,
      chatType: chat?.type ?? null,
      chatTitle: (chat as any)?.title ?? null,
      messageText: text,
      rawUpdate: JSON.stringify(update),
      receivedAt: now,
      isBot: from?.is_bot ?? false,
      languageCode: from?.language_code ?? null,
      fileType,
      callbackData,
      inlineQuery,
    }).run();

    // Track user
    if (from && !from.is_bot) {
      await this.upsertUser(from, now);
      await this.upsertBotUserActivity(botId, from.id, now);
    }

    // Update hourly stats
    await this.incrementHourlyStat(botId, updateType, now);
  }

  // ── Log an error/info message ─────────────────────────────────────────────
  async logError(
    botId: string | null,
    level: 'error' | 'warn' | 'info',
    message: string,
    stack?: string,
    context?: Record<string, any>,
  ): Promise<void> {
    this.db.insert(errorLogs).values({
      botId,
      level,
      message,
      stack: stack ?? null,
      context: context ? JSON.stringify(context) : null,
      alertSent: false,
      createdAt: Date.now(),
    }).run();
  }

  // ── Query update logs ─────────────────────────────────────────────────────
  async getUpdateLogs(filter: LogsFilter): Promise<{ data: UpdateLog[]; total: number }> {
    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const conditions: any[] = [];
    if (filter.botId) conditions.push(eq(updateLogs.botId, filter.botId));
    if (filter.userId) conditions.push(eq(updateLogs.userId, filter.userId));
    if (filter.updateType) conditions.push(eq(updateLogs.updateType, filter.updateType));
    if (filter.from) conditions.push(gte(updateLogs.receivedAt, filter.from));
    if (filter.to) conditions.push(lte(updateLogs.receivedAt, filter.to));
    if (filter.search) {
      conditions.push(
        sql`(${updateLogs.messageText} LIKE ${'%' + filter.search + '%'} 
          OR ${updateLogs.username} LIKE ${'%' + filter.search + '%'}
          OR ${updateLogs.firstName} LIKE ${'%' + filter.search + '%'})`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = this.db
      .select()
      .from(updateLogs)
      .where(whereClause)
      .orderBy(desc(updateLogs.receivedAt))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = this.db
      .select({ count: count() })
      .from(updateLogs)
      .where(whereClause)
      .get();

    return { data, total: totalResult?.count ?? 0 };
  }

  // ── Error logs ────────────────────────────────────────────────────────────
  async getErrorLogs(botId?: string, limit = 50, offset = 0): Promise<{ data: ErrorLog[]; total: number }> {
    const where = botId ? eq(errorLogs.botId, botId) : undefined;

    const data = this.db
      .select()
      .from(errorLogs)
      .where(where)
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    const totalResult = this.db
      .select({ count: count() })
      .from(errorLogs)
      .where(where)
      .get();

    return { data, total: totalResult?.count ?? 0 };
  }

  // ── Hourly stats ──────────────────────────────────────────────────────────
  async getHourlyStats(botId: string, fromHour: number, toHour: number) {
    return this.db
      .select()
      .from(hourlyStats)
      .where(
        and(
          eq(hourlyStats.botId, botId),
          gte(hourlyStats.hour, fromHour),
          lte(hourlyStats.hour, toHour),
        ),
      )
      .orderBy(hourlyStats.hour)
      .all();
  }

  // ── Top users ─────────────────────────────────────────────────────────────
  async getTopUsers(botId: string, limit = 10) {
    return this.db
      .select()
      .from(botUserActivity)
      .where(eq(botUserActivity.botId, botId))
      .orderBy(desc(botUserActivity.messageCount))
      .limit(limit)
      .all();
  }

  // ── Update type distribution ──────────────────────────────────────────────
  async getUpdateTypeStats(botId: string, from?: number) {
    const conditions: any[] = [eq(updateLogs.botId, botId)];
    if (from) conditions.push(gte(updateLogs.receivedAt, from));

    return this.db
      .select({
        updateType: updateLogs.updateType,
        count: count(),
      })
      .from(updateLogs)
      .where(and(...conditions))
      .groupBy(updateLogs.updateType)
      .all();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private detectUpdateType(update: Update): string {
    const u = update as any;
    if (u.message) return 'message';
    if (u.edited_message) return 'edited_message';
    if (u.channel_post) return 'channel_post';
    if (u.callback_query) return 'callback_query';
    if (u.inline_query) return 'inline_query';
    if (u.chosen_inline_result) return 'chosen_inline_result';
    if (u.shipping_query) return 'shipping_query';
    if (u.pre_checkout_query) return 'pre_checkout_query';
    if (u.poll) return 'poll';
    if (u.poll_answer) return 'poll_answer';
    if (u.my_chat_member) return 'my_chat_member';
    if (u.chat_member) return 'chat_member';
    if (u.chat_join_request) return 'chat_join_request';
    return 'unknown';
  }

  private extractFrom(update: Update): any {
    const u = update as any;
    return (
      u.message?.from ??
      u.edited_message?.from ??
      u.callback_query?.from ??
      u.inline_query?.from ??
      u.channel_post?.from ??
      null
    );
  }

  private extractChat(update: Update): any {
    const u = update as any;
    return (
      u.message?.chat ??
      u.edited_message?.chat ??
      u.channel_post?.chat ??
      u.callback_query?.message?.chat ??
      null
    );
  }

  // Upsert known chat info
  private async upsertKnownChat(botId: string, chat: any, now: number, updateId: number): Promise<void> {
    const insert: InsertKnownChat = {
      botId,
      chatId: chat.id,
      chatType: chat.type ?? 'private',
      title: chat.title ?? null,
      username: chat.username ?? null,
      firstName: chat.first_name ?? null,
      lastName: chat.last_name ?? null,
      lastMessageAt: now,
      lastUpdateId: updateId,
      canSend: true,
      isBlocked: false,
      tags: null,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(knownChats)
      .values(insert)
      .onConflictDoUpdate({
        target: [knownChats.botId, knownChats.chatId],
        set: {
          chatType: chat.type ?? 'private',
          title: chat.title ?? null,
          username: chat.username ?? null,
          firstName: chat.first_name ?? null,
          lastName: chat.last_name ?? null,
          lastMessageAt: now,
          lastUpdateId: updateId,
          updatedAt: now,
        },
      })
      .run();
  }

  // Upsert media asset info
  private async upsertMediaAsset(botId: string, media: any, now: number): Promise<void> {
    const insert: InsertMediaAsset = {
      botId,
      fileType: media.fileType,
      fileId: media.fileId,
      fileUniqueId: media.fileUniqueId,
      fileName: media.fileName ?? null,
      mimeType: media.mimeType ?? null,
      fileSize: media.fileSize ?? null,
      title: media.title ?? null,
      createdAt: now,
    };
    this.db.insert(mediaAssets)
      .values(insert)
      .onConflictDoNothing()
      .run();
  }

  // Extract all media assets from update
  private extractMediaAssets(update: Update): any[] {
    const u = update as any;
    const media: any[] = [];
    const msg = u.message || u.edited_message || u.channel_post || (u.callback_query && u.callback_query.message);
    if (!msg) return media;
    // Photo
    if (msg.photo && Array.isArray(msg.photo)) {
      for (const p of msg.photo) {
        media.push({
          fileType: 'photo',
          fileId: p.file_id,
          fileUniqueId: p.file_unique_id,
          fileName: null,
          mimeType: null,
          fileSize: p.file_size,
          title: null,
        });
      }
    }
    // Video
    if (msg.video) {
      media.push({
        fileType: 'video',
        fileId: msg.video.file_id,
        fileUniqueId: msg.video.file_unique_id,
        fileName: msg.video.file_name ?? null,
        mimeType: msg.video.mime_type ?? null,
        fileSize: msg.video.file_size ?? null,
        title: null,
      });
    }
    // Document
    if (msg.document) {
      media.push({
        fileType: 'document',
        fileId: msg.document.file_id,
        fileUniqueId: msg.document.file_unique_id,
        fileName: msg.document.file_name ?? null,
        mimeType: msg.document.mime_type ?? null,
        fileSize: msg.document.file_size ?? null,
        title: msg.document.file_name ?? null,
      });
    }
    // Audio
    if (msg.audio) {
      media.push({
        fileType: 'audio',
        fileId: msg.audio.file_id,
        fileUniqueId: msg.audio.file_unique_id,
        fileName: msg.audio.file_name ?? null,
        mimeType: msg.audio.mime_type ?? null,
        fileSize: msg.audio.file_size ?? null,
        title: msg.audio.title ?? null,
      });
    }
    // Voice
    if (msg.voice) {
      media.push({
        fileType: 'voice',
        fileId: msg.voice.file_id,
        fileUniqueId: msg.voice.file_unique_id,
        fileName: null,
        mimeType: msg.voice.mime_type ?? null,
        fileSize: msg.voice.file_size ?? null,
        title: null,
      });
    }
    // Video Note
    if (msg.video_note) {
      media.push({
        fileType: 'video_note',
        fileId: msg.video_note.file_id,
        fileUniqueId: msg.video_note.file_unique_id,
        fileName: null,
        mimeType: null,
        fileSize: msg.video_note.file_size ?? null,
        title: null,
      });
    }
    // Sticker
    if (msg.sticker) {
      media.push({
        fileType: 'sticker',
        fileId: msg.sticker.file_id,
        fileUniqueId: msg.sticker.file_unique_id,
        fileName: null,
        mimeType: msg.sticker.mime_type ?? null,
        fileSize: msg.sticker.file_size ?? null,
        title: null,
      });
    }
    // Animation
    if (msg.animation) {
      media.push({
        fileType: 'animation',
        fileId: msg.animation.file_id,
        fileUniqueId: msg.animation.file_unique_id,
        fileName: msg.animation.file_name ?? null,
        mimeType: msg.animation.mime_type ?? null,
        fileSize: msg.animation.file_size ?? null,
        title: null,
      });
    }
    return media;
  }

  private extractText(update: Update): string | null {
    const u = update as any;
    return (
      u.message?.text ??
      u.message?.caption ??
      u.edited_message?.text ??
      u.channel_post?.text ??
      u.callback_query?.message?.text ??
      null
    );
  }

  private extractFileType(update: Update): string | null {
    const msg = (update as any).message;
    if (!msg) return null;
    if (msg.photo) return 'photo';
    if (msg.video) return 'video';
    if (msg.document) return 'document';
    if (msg.audio) return 'audio';
    if (msg.voice) return 'voice';
    if (msg.video_note) return 'video_note';
    if (msg.sticker) return 'sticker';
    if (msg.animation) return 'animation';
    if (msg.location) return 'location';
    if (msg.contact) return 'contact';
    if (msg.poll) return 'poll';
    return null;
  }

  private upsertUser(from: any, now: number): void {
    this.db
      .insert(users)
      .values({
        id: from.id,
        username: from.username ?? null,
        firstName: from.first_name ?? null,
        lastName: from.last_name ?? null,
        languageCode: from.language_code ?? null,
        isBot: from.is_bot ?? false,
        firstSeenAt: now,
        lastSeenAt: now,
        messageCount: 1,
      })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          username: from.username ?? null,
          firstName: from.first_name ?? null,
          lastName: from.last_name ?? null,
          lastSeenAt: now,
          messageCount: sql`message_count + 1`,
        },
      })
      .run();
  }

  private upsertBotUserActivity(botId: string, userId: number, now: number): void {
    this.db
      .insert(botUserActivity)
      .values({
        botId,
        userId,
        messageCount: 1,
        firstMessageAt: now,
        lastMessageAt: now,
      })
      .onConflictDoUpdate({
        target: [botUserActivity.botId, botUserActivity.userId],
        set: {
          messageCount: sql`message_count + 1`,
          lastMessageAt: now,
        },
      })
      .run();
  }

  private incrementHourlyStat(botId: string, updateType: string, now: number): void {
    const hour = Math.floor(now / 3_600_000) * 3_600_000;
    this.db
      .insert(hourlyStats)
      .values({
        botId,
        hour,
        messageCount: updateType === 'message' ? 1 : 0,
        uniqueUsers: 0,
        callbackCount: updateType === 'callback_query' ? 1 : 0,
        errorCount: 0,
      })
      .onConflictDoUpdate({
        target: [hourlyStats.botId, hourlyStats.hour],
        set: {
          messageCount: updateType === 'message'
            ? sql`message_count + 1`
            : sql`message_count`,
          callbackCount: updateType === 'callback_query'
            ? sql`callback_count + 1`
            : sql`callback_count`,
        },
      })
      .run();
  }
}
