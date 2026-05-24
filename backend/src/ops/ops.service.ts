import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { BotRegistryService } from '../bots/bot-registry.service';
import { BotsService } from '../bots/bots.service';
import { DatabaseService } from '../database/database.service';
import { auditLogs, broadcastJobs, broadcastTargets, knownChats, mediaAssets, outboundMessages } from '../database/schema';
import { LogsService } from '../logs/logs.service';
import { AdminChatActionDto } from './dto/admin-chat-action.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class OpsService {
  private readonly logger = new Logger(OpsService.name);

  constructor(
    private readonly dbService: DatabaseService,
    private readonly botsService: BotsService,
    private readonly registry: BotRegistryService,
    private readonly logsService: LogsService,
  ) {}

  get db() { return this.dbService.db; }

  // --- Chats ---
  async getChats(filters: { botId?: string; chatType?: string; search?: string; canSend?: boolean; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const conditions: any[] = [];
    if (filters.botId) conditions.push(eq(knownChats.botId, filters.botId));
    if (filters.chatType) conditions.push(eq(knownChats.chatType, filters.chatType));
    if (filters.canSend !== undefined) conditions.push(eq(knownChats.canSend, filters.canSend));
    if (filters.search) {
      conditions.push(
        sql`(${knownChats.title} LIKE ${'%' + filters.search + '%'} OR ${knownChats.username} LIKE ${'%' + filters.search + '%'} OR ${knownChats.firstName} LIKE ${'%' + filters.search + '%'})`
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = this.db.select().from(knownChats).where(where).orderBy(desc(knownChats.lastMessageAt)).limit(limit).offset(offset).all();
    const total = this.db.select({ count: count() }).from(knownChats).where(where).get();
    return { data, total: total?.count ?? 0 };
  }

  async getChat(chatId: number) {
    const chat = this.db.select().from(knownChats).where(eq(knownChats.id, chatId)).get();
    if (!chat) throw new NotFoundException('Chat not found');
    return chat;
  }

  async refreshChat(chatId: number) {
    const chat = await this.getChat(chatId);
    const telegraf = this.registry.getTelegram(chat.botId);
    this.registry.assertBotRunning(chat.botId);

    const update: any = await telegraf.telegram.getChat(chat.chatId);
    this.db.update(knownChats).set({
      title: update.title ?? chat.title,
      username: update.username ?? chat.username,
      firstName: update.first_name ?? chat.firstName,
      lastName: update.last_name ?? chat.lastName,
      chatType: update.type ?? chat.chatType,
      updatedAt: Date.now(),
    }).where(eq(knownChats.id, chatId)).run();

    return this.getChat(chatId);
  }

  async scanChatPermissions(chatId: number) {
    const chat = await this.getChat(chatId);
    const telegraf = this.registry.getTelegram(chat.botId);
    this.registry.assertBotRunning(chat.botId);

    const botInfo = await telegraf.telegram.getMe();
    const selfMember: any = await telegraf.telegram.getChatMember(chat.chatId, botInfo.id).catch(() => null);
    const admins: any[] = chat.chatType !== 'private'
      ? await telegraf.telegram.getChatAdministrators(chat.chatId).catch(() => [])
      : [];

    const status = selfMember?.status ?? 'unknown';
    const isAdmin = status === 'administrator' || status === 'creator';
    const permissions = {
      isAdmin,
      adminStatus: status,
      canSendMessages: !!(status && !['left', 'kicked'].includes(status)),
      canSendMedia: !!(status && !['left', 'kicked'].includes(status)),
      canDeleteMessages: !!selfMember?.can_delete_messages,
      canPinMessages: !!selfMember?.can_pin_messages,
      canInviteUsers: !!selfMember?.can_invite_users,
      canRestrictMembers: !!selfMember?.can_restrict_members,
      canPromoteMembers: !!selfMember?.can_promote_members,
      canChangeInfo: !!selfMember?.can_change_info,
      admins: admins.map((admin) => ({ userId: admin.user?.id, status: admin.status, username: admin.user?.username ?? null })),
    };

    this.db.update(knownChats).set({
      permissionsJson: JSON.stringify(permissions),
      permissionsCheckedAt: Date.now(),
      updatedAt: Date.now(),
    }).where(eq(knownChats.id, chatId)).run();

    return permissions;
  }

  async registerMedia(dto: { botId: string; fileType: string; fileId: string; fileUniqueId?: string; fileName?: string; mimeType?: string; fileSize?: number; title?: string; }) {
    const record = {
      botId: dto.botId,
      fileType: dto.fileType,
      fileId: dto.fileId,
      fileUniqueId: dto.fileUniqueId ?? dto.fileId,
      fileName: dto.fileName ?? null,
      mimeType: dto.mimeType ?? null,
      fileSize: dto.fileSize ?? null,
      title: dto.title ?? null,
      createdAt: Date.now(),
    };
    this.db.insert(mediaAssets).values(record).run();
    return record;
  }

  async getMediaAssets(filters: { botId?: string; fileType?: string; search?: string; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const conditions: any[] = [];
    if (filters.botId) conditions.push(eq(mediaAssets.botId, filters.botId));
    if (filters.fileType) conditions.push(eq(mediaAssets.fileType, filters.fileType));
    if (filters.search) {
      conditions.push(
        sql`(${mediaAssets.title} LIKE ${'%' + filters.search + '%'} OR ${mediaAssets.fileName} LIKE ${'%' + filters.search + '%'} OR ${mediaAssets.fileId} LIKE ${'%' + filters.search + '%'})`
      );
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = this.db.select().from(mediaAssets).where(where).orderBy(desc(mediaAssets.createdAt)).limit(limit).offset(offset).all();
    const total = this.db.select({ count: count() }).from(mediaAssets).where(where).get();
    return { data, total: total?.count ?? 0 };
  }

  async previewBroadcastTargets(dto: { botId?: string; chatType?: string; canSend?: string; isBlocked?: string; tags?: string; search?: string }) {
    const baseConditions: any[] = [];
    if (dto.botId) baseConditions.push(eq(knownChats.botId, dto.botId));
    if (dto.chatType) baseConditions.push(eq(knownChats.chatType, dto.chatType));
    if (dto.tags) baseConditions.push(sql`${knownChats.tags} LIKE ${'%' + dto.tags + '%'}`);
    if (dto.search) {
      baseConditions.push(
        sql`(${knownChats.title} LIKE ${'%' + dto.search + '%'} OR ${knownChats.username} LIKE ${'%' + dto.search + '%'} OR ${knownChats.firstName} LIKE ${'%' + dto.search + '%'} OR ${knownChats.lastName} LIKE ${'%' + dto.search + '%'})`
      );
    }
    const targetConditions = [...baseConditions];
    if (dto.canSend !== undefined) targetConditions.push(eq(knownChats.canSend, dto.canSend === 'true'));
    if (dto.isBlocked !== undefined) targetConditions.push(eq(knownChats.isBlocked, dto.isBlocked === 'true'));

    const sample = this.db.select().from(knownChats).where(targetConditions.length > 0 ? and(...targetConditions) : undefined).orderBy(desc(knownChats.lastMessageAt)).limit(10).all();
    const total = this.db.select({ count: count() }).from(knownChats).where(targetConditions.length > 0 ? and(...targetConditions) : undefined).get();
    const excludedBlocked = this.db.select({ count: count() }).from(knownChats).where(baseConditions.length > 0 ? and(...baseConditions, eq(knownChats.isBlocked, true)) : eq(knownChats.isBlocked, true)).get();
    const excludedCannotSend = this.db.select({ count: count() }).from(knownChats).where(baseConditions.length > 0 ? and(...baseConditions, eq(knownChats.canSend, false)) : eq(knownChats.canSend, false)).get();

    return {
      totalTargets: total?.count ?? 0,
      sample,
      excludedBlocked: excludedBlocked?.count ?? 0,
      excludedCannotSend: excludedCannotSend?.count ?? 0,
    };
  }

  // --- Messaging ---
  private async resolveChatType(botId: string, chatId: string | number): Promise<string> {
    const match = this.db.select({ chatType: knownChats.chatType })
      .from(knownChats)
      .where(and(eq(knownChats.botId, botId), eq(knownChats.chatId, Number(chatId))))
      .get();
    return match?.chatType ?? 'private';
  }

  async sendMessage(dto: SendMessageDto): Promise<any> {
    const telegraf = this.registry.getTelegram(dto.botId);
    this.registry.assertBotRunning(dto.botId);

    const chatId = isNaN(Number(dto.chatId)) ? dto.chatId : Number(dto.chatId);
    const parseMode = dto.parseMode ?? undefined;
    const targetType = await this.resolveChatType(dto.botId, chatId);

    if (dto.type === 'text' && !dto.text) {
      throw new BadRequestException('Text is required for text messages');
    }
    if (dto.type !== 'text' && !dto.mediaFileId && !dto.mediaUrl) {
      throw new BadRequestException('Media file_id or mediaUrl is required for media messages');
    }

    let result: any;
    try {
      const replyOptions = dto.replyToMessageId ? { reply_to_message_id: dto.replyToMessageId } : {};
      switch (dto.type) {
        case 'text':
          result = await telegraf.telegram.sendMessage(chatId, dto.text!, { parse_mode: parseMode as any, ...replyOptions });
          break;
        case 'photo':
          result = await telegraf.telegram.sendPhoto(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'video':
          result = await telegraf.telegram.sendVideo(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'animation':
          result = await telegraf.telegram.sendAnimation(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'audio':
          result = await telegraf.telegram.sendAudio(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'voice':
          result = await telegraf.telegram.sendVoice(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'document':
          result = await telegraf.telegram.sendDocument(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'sticker':
          if (!dto.mediaFileId) {
            throw new BadRequestException('Sticker file_id is required for sticker messages');
          }
          result = await telegraf.telegram.sendSticker(chatId, dto.mediaFileId, {
            reply_parameters: dto.replyToMessageId ? { message_id: dto.replyToMessageId } : undefined,
          });
          break;
        default:
          throw new BadRequestException(`Unsupported message type: ${dto.type}`);
      }

      this.db.insert(outboundMessages).values({
        botId: dto.botId,
        targetChatId: String(chatId),
        targetType,
        messageType: dto.type,
        text: dto.type === 'text' ? dto.text ?? null : dto.caption ?? null,
        mediaFileId: dto.mediaFileId ?? null,
        mediaUrl: dto.mediaUrl ?? null,
        caption: dto.caption ?? null,
        replyToMessageId: dto.replyToMessageId ?? null,
        telegramMessageId: result?.message_id,
        status: 'sent',
        createdAt: Date.now(),
        sentAt: Date.now(),
      }).run();

      this.logAudit(dto.botId, 'send_message', String(chatId), dto, result, 'success');

      return result;
    } catch (err) {
      const msg = err?.message || String(err);
      this.db.insert(outboundMessages).values({
        botId: dto.botId,
        targetChatId: String(chatId),
        targetType,
        messageType: dto.type,
        text: dto.type === 'text' ? dto.text ?? null : dto.caption ?? null,
        mediaFileId: dto.mediaFileId ?? null,
        mediaUrl: dto.mediaUrl ?? null,
        caption: dto.caption ?? null,
        replyToMessageId: dto.replyToMessageId ?? null,
        status: 'failed',
        errorMessage: msg,
        createdAt: Date.now(),
      }).run();

      this.logAudit(dto.botId, 'send_message', String(chatId), dto, null, 'failed', msg);

      if (msg.includes('bot was blocked') || msg.includes('Forbidden')) {
        this.db.update(knownChats).set({ isBlocked: true }).where(and(eq(knownChats.botId, dto.botId), eq(knownChats.chatId, Number(chatId)))).run();
      }

      throw new BadRequestException(`Send failed: ${msg}`);
    }
  }

  async replyMessage(dto: ReplyMessageDto): Promise<any> {
    const telegraf = this.registry.getTelegram(dto.botId);
    this.registry.assertBotRunning(dto.botId);

    const chatId = isNaN(Number(dto.chatId)) ? dto.chatId : Number(dto.chatId);
    const parseMode = dto.parseMode ?? undefined;
    const targetType = await this.resolveChatType(dto.botId, chatId);

    if (dto.type === 'text' && !dto.text) {
      throw new BadRequestException('Text is required for text replies');
    }
    if (dto.type !== 'text' && !dto.mediaFileId && !dto.mediaUrl) {
      throw new BadRequestException('Media file_id or mediaUrl is required for media replies');
    }

    let result: any;
    try {
      const replyOptions = { reply_to_message_id: dto.messageId };
      switch (dto.type) {
        case 'text':
          result = await telegraf.telegram.sendMessage(chatId, dto.text!, { parse_mode: parseMode as any, ...replyOptions });
          break;
        case 'photo':
          result = await telegraf.telegram.sendPhoto(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'video':
          result = await telegraf.telegram.sendVideo(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'animation':
          result = await telegraf.telegram.sendAnimation(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'audio':
          result = await telegraf.telegram.sendAudio(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'voice':
          result = await telegraf.telegram.sendVoice(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'document':
          result = await telegraf.telegram.sendDocument(chatId, dto.mediaFileId ? dto.mediaFileId : { url: dto.mediaUrl } as any, {
            caption: dto.caption,
            parse_mode: parseMode as any,
            ...replyOptions,
          });
          break;
        case 'sticker':
          if (!dto.mediaFileId) {
            throw new BadRequestException('Sticker file_id is required for sticker replies');
          }
          result = await telegraf.telegram.sendSticker(chatId, dto.mediaFileId, {
            reply_parameters: { message_id: dto.messageId },
          });
          break;
        default:
          throw new BadRequestException(`Unsupported message type: ${dto.type}`);
      }

      this.db.insert(outboundMessages).values({
        botId: dto.botId,
        targetChatId: String(chatId),
        targetType,
        messageType: dto.type,
        text: dto.type === 'text' ? dto.text ?? null : dto.caption ?? null,
        mediaFileId: dto.mediaFileId ?? null,
        mediaUrl: dto.mediaUrl ?? null,
        caption: dto.caption ?? null,
        replyToMessageId: dto.messageId,
        telegramMessageId: result?.message_id,
        status: 'sent',
        createdAt: Date.now(),
        sentAt: Date.now(),
      }).run();

      this.logAudit(dto.botId, 'reply_message', String(chatId), dto, result, 'success');
      return result;
    } catch (err) {
      const msg = err?.message || String(err);
      this.db.insert(outboundMessages).values({
        botId: dto.botId,
        targetChatId: String(chatId),
        targetType,
        messageType: dto.type,
        text: dto.type === 'text' ? dto.text ?? null : dto.caption ?? null,
        mediaFileId: dto.mediaFileId ?? null,
        mediaUrl: dto.mediaUrl ?? null,
        caption: dto.caption ?? null,
        replyToMessageId: dto.messageId,
        status: 'failed',
        errorMessage: msg,
        createdAt: Date.now(),
      }).run();
      this.logAudit(dto.botId, 'reply_message', String(chatId), dto, null, 'failed', msg);
      if (msg.includes('bot was blocked') || msg.includes('Forbidden')) {
        this.db.update(knownChats).set({ isBlocked: true }).where(and(eq(knownChats.botId, dto.botId), eq(knownChats.chatId, Number(chatId)))).run();
      }
      throw new BadRequestException(`Reply failed: ${msg}`);
    }
  }

  // --- Broadcast ---
  async createBroadcast(dto: CreateBroadcastDto) {
    const job = this.db.insert(broadcastJobs).values({
      botId: dto.botId ?? null,
      title: dto.title,
      messageType: dto.messageType,
      payloadJson: JSON.stringify({ text: dto.text, caption: dto.caption, mediaFileId: dto.mediaFileId, mediaUrl: dto.mediaUrl }),
      filtersJson: dto.filtersJson ?? null,
      status: 'pending',
      totalTargets: 0,
      successCount: 0,
      failedCount: 0,
      createdBy: 'dashboard',
      createdAt: Date.now(),
    }).returning().get();

    this.logAudit(dto.botId ?? 'all', 'create_broadcast', null, dto, job, 'success');
    return job;
  }

  async startBroadcast(jobId: number) {
    const job = this.db.select().from(broadcastJobs).where(eq(broadcastJobs.id, jobId)).get();
    if (!job) throw new NotFoundException('Broadcast job not found');
    if (job.status === 'running') throw new ConflictException('Broadcast is already running');
    if (job.status === 'cancelled') throw new ConflictException('Broadcast was cancelled');

    const filters = job.filtersJson ? JSON.parse(job.filtersJson) : {};

    const conditions: any[] = [];
    if (job.botId) conditions.push(eq(knownChats.botId, job.botId));
    if (filters.chatType) conditions.push(eq(knownChats.chatType, filters.chatType));
    conditions.push(eq(knownChats.isBlocked, false));
    conditions.push(eq(knownChats.canSend, true));

    const targets = this.db.select().from(knownChats).where(and(...conditions)).all();

    this.db.update(broadcastJobs).set({
      status: 'running',
      totalTargets: targets.length,
      startedAt: Date.now(),
    }).where(eq(broadcastJobs.id, jobId)).run();

    this.logAudit(job.botId ?? 'all', 'start_broadcast', null, { jobId }, null, 'running');

    this.processBroadcast(job, targets, JSON.parse(job.payloadJson)).catch(err => {
      this.logger.error(`Broadcast ${jobId} processing error: ${err.message}`);
    });

    return { jobId, totalTargets: targets.length, status: 'running' };
  }

  private async processBroadcast(job: any, targets: any[], payload: any) {
    let success = 0;
    let failed = 0;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      try {
        const telegraf = this.registry.getTelegram(target.botId);
        this.registry.assertBotRunning(target.botId);

        let result: any;
        switch (job.messageType) {
          case 'text':
            result = await telegraf.telegram.sendMessage(target.chatId, payload.text ?? '');
            break;
          case 'photo':
          result = await telegraf.telegram.sendPhoto(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'video':
          result = await telegraf.telegram.sendVideo(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'animation':
          result = await telegraf.telegram.sendAnimation(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'audio':
          result = await telegraf.telegram.sendAudio(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'voice':
          result = await telegraf.telegram.sendVoice(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'document':
          result = await telegraf.telegram.sendDocument(target.chatId, payload.mediaFileId ? payload.mediaFileId : { url: payload.mediaUrl } as any, { caption: payload.caption });
          break;
        case 'sticker':
          if (!payload.mediaFileId) {
            throw new Error('Sticker file_id is required for broadcast sticker messages');
          }
          result = await telegraf.telegram.sendSticker(target.chatId, payload.mediaFileId);
          break;
        }

        this.db.insert(broadcastTargets).values({
          jobId: job.id,
          botId: target.botId,
          chatId: target.chatId,
          status: 'sent',
          telegramMessageId: result?.message_id,
          sentAt: Date.now(),
        }).run();
        success++;
      } catch (err) {
        const msg = err?.message || String(err);
        this.db.insert(broadcastTargets).values({
          jobId: job.id,
          botId: target.botId,
          chatId: target.chatId,
          status: 'failed',
          errorMessage: msg,
        }).run();
        failed++;
      }

      this.db.update(broadcastJobs).set({
        successCount: success,
        failedCount: failed,
      }).where(eq(broadcastJobs.id, job.id)).run();

      await new Promise(r => setTimeout(r, 50));
    }

    const finalStatus = failed > 0 && success === 0 ? 'failed' : 'completed';
    this.db.update(broadcastJobs).set({
      status: finalStatus,
      finishedAt: Date.now(),
      successCount: success,
      failedCount: failed,
    }).where(eq(broadcastJobs.id, job.id)).run();

    this.logAudit(job.botId ?? 'all', 'finish_broadcast', null, { jobId: job.id }, { success, failed }, finalStatus);
  }

  async getBroadcasts(filters: { status?: string; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 20;
    const offset = filters.offset ?? 0;
    const conditions: any[] = [];
    if (filters.status) conditions.push(eq(broadcastJobs.status, filters.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = this.db.select().from(broadcastJobs).where(where).orderBy(desc(broadcastJobs.createdAt)).limit(limit).offset(offset).all();
    const total = this.db.select({ count: count() }).from(broadcastJobs).where(where).get();
    return { data, total: total?.count ?? 0 };
  }

  async getBroadcast(id: number) {
    const job = this.db.select().from(broadcastJobs).where(eq(broadcastJobs.id, id)).get();
    if (!job) throw new NotFoundException('Broadcast not found');
    const targets = this.db.select().from(broadcastTargets).where(eq(broadcastTargets.jobId, id)).all();
    return { ...job, targets };
  }

  async cancelBroadcast(id: number) {
    const job = this.db.select().from(broadcastJobs).where(eq(broadcastJobs.id, id)).get();
    if (!job) throw new NotFoundException('Broadcast not found');
    if (job.status === 'completed' || job.status === 'cancelled') throw new ConflictException('Broadcast already finished');
    this.db.update(broadcastJobs).set({ status: 'cancelled', finishedAt: Date.now() }).where(eq(broadcastJobs.id, id)).run();
    this.logAudit(job.botId ?? 'all', 'cancel_broadcast', null, { jobId: id }, null, 'cancelled');
    return { message: 'Broadcast cancelled' };
  }

  // --- Admin actions ---
  async chatAction(dto: AdminChatActionDto): Promise<any> {
    const telegraf = this.registry.getTelegram(dto.botId);
    this.registry.assertBotRunning(dto.botId);
    const chatId = isNaN(Number(dto.chatId)) ? dto.chatId : Number(dto.chatId);

    const dangerousAdminActions = new Set([
      'banChatMember',
      'restrictChatMember',
      'promoteChatMember',
      'deleteMessage',
      'setChatTitle',
      'setChatDescription',
      'createChatInviteLink',
    ]);

    if (dangerousAdminActions.has(dto.action)) {
      if (!dto.confirm) {
        throw new BadRequestException(`Action ${dto.action} must be confirmed before execution.`);
      }
      if (!dto.reason || dto.reason.trim().length < 8) {
        throw new BadRequestException('A reason of at least 8 characters is required for dangerous admin actions.');
      }
    }

    try {
      let result: any;
      switch (dto.action) {
        case 'getChat':
          result = await telegraf.telegram.getChat(chatId);
          break;
        case 'getChatAdministrators':
          result = await telegraf.telegram.getChatAdministrators(chatId);
          break;
        case 'banChatMember':
          result = await telegraf.telegram.banChatMember(chatId, dto.payload?.userId);
          break;
        case 'unbanChatMember':
          result = await telegraf.telegram.unbanChatMember(chatId, dto.payload?.userId);
          break;
        case 'restrictChatMember':
          result = await telegraf.telegram.restrictChatMember(chatId, dto.payload?.userId, dto.payload?.permissions ?? {});
          break;
        case 'promoteChatMember':
          result = await telegraf.telegram.promoteChatMember(chatId, dto.payload?.userId, dto.payload?.rights ?? {});
          break;
        case 'setChatTitle':
          result = await telegraf.telegram.setChatTitle(chatId, dto.payload?.title);
          break;
        case 'setChatDescription':
          result = await telegraf.telegram.setChatDescription(chatId, dto.payload?.description);
          break;
        case 'pinChatMessage':
          result = await telegraf.telegram.pinChatMessage(chatId, dto.payload?.messageId);
          break;
        case 'unpinChatMessage':
          result = await telegraf.telegram.unpinChatMessage(chatId, dto.payload?.messageId);
          break;
        case 'deleteMessage':
          result = await telegraf.telegram.deleteMessage(chatId, dto.payload?.messageId);
          break;
        case 'createChatInviteLink':
          result = await telegraf.telegram.createChatInviteLink(chatId, dto.payload ?? {});
          break;
      }

      this.logAudit(dto.botId, dto.action, String(chatId), { ...dto, reason: dto.reason }, result, 'success', undefined, 'operator');
      return result;
    } catch (err) {
      const msg = err?.message || String(err);
      this.logAudit(dto.botId, dto.action, String(chatId), { ...dto, reason: dto.reason }, null, 'failed', msg, 'operator');
      throw new BadRequestException(`Admin action failed: ${msg}`);
    }
  }

  async getOutboundMessages(filters: { botId?: string; status?: string; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const conditions: any[] = [];
    if (filters.botId) conditions.push(eq(outboundMessages.botId, filters.botId));
    if (filters.status) conditions.push(eq(outboundMessages.status, filters.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = this.db.select().from(outboundMessages).where(where).orderBy(desc(outboundMessages.createdAt)).limit(limit).offset(offset).all();
    const total = this.db.select({ count: count() }).from(outboundMessages).where(where).get();
    return { data, total: total?.count ?? 0 };
  }

  // --- Audit ---
  async getAuditLogs(filters: { botId?: string; action?: string; status?: string; limit?: number; offset?: number }) {
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const conditions: any[] = [];
    if (filters.botId) conditions.push(eq(auditLogs.botId, filters.botId));
    if (filters.action) conditions.push(eq(auditLogs.action, filters.action));
    if (filters.status) conditions.push(eq(auditLogs.status, filters.status));
    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const data = this.db.select().from(auditLogs).where(where).orderBy(desc(auditLogs.createdAt)).limit(limit).offset(offset).all();
    const total = this.db.select({ count: count() }).from(auditLogs).where(where).get();
    return { data, total: total?.count ?? 0 };
  }

  private logAudit(botId: string, action: string, targetChatId?: string, payload?: any, result?: any, status?: string, errorMessage?: string, actor = 'dashboard') {
    try {
      this.db.insert(auditLogs).values({
        botId,
        actor,
        action,
        targetChatId: targetChatId ?? null,
        payloadJson: payload ? JSON.stringify(payload) : null,
        resultJson: result ? JSON.stringify(result) : null,
        status: status ?? 'success',
        errorMessage: errorMessage ?? null,
        createdAt: Date.now(),
      }).run();
    } catch (err) {
      this.logger.error(`Audit log error: ${err.message}`);
    }
  }
}
