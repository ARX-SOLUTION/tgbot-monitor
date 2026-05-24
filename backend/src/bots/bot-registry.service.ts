import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  OnModuleDestroy,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BotsService } from './bots.service';
import { LogsService } from '../logs/logs.service';
import { AlertsService } from '../alerts/alerts.service';
import { DatabaseService } from '../database/database.service';
import { Bot, knownChats } from '../database/schema';
import { eq, and } from 'drizzle-orm';

export interface BotInstance {
  bot: Telegraf;
  botRecord: Bot;
  isRunning: boolean;
  startedAt: Date | null;
  errorCount: number;
  lastError: string | null;
}

@Injectable()
export class BotRegistryService implements OnModuleDestroy, OnApplicationBootstrap {
  private readonly logger = new Logger(BotRegistryService.name);
  private readonly instances = new Map<string, BotInstance>();

  constructor(
    private readonly botsService: BotsService,
    private readonly logsService: LogsService,
    private readonly alertsService: AlertsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly dbService: DatabaseService,
  ) {}

  async onApplicationBootstrap() {
    // Delay startup to allow any old process polling connection to fully close
    await new Promise(r => setTimeout(r, 3000));

    const activeBots = await this.botsService.findAll();
    for (const bot of activeBots) {
      if (bot.isActive) {
        try {
          await this.startBot(bot);
        } catch (err) {
          this.logger.error(`Failed to start bot ${bot.name}: ${err.message}`);
        }
      }
    }
    this.logger.log(`Started ${this.instances.size} bots`);
  }

  private async launchWithRetry(telegraf: Telegraf, maxRetries = 3): Promise<void> {
    // Steal the polling connection from any other instance using the same token.
    // A getUpdates with offset=-1 & timeout=0 returns immediately and causes
    // any other active polling session to receive a 409 and disconnect.
    try {
      await telegraf.telegram.callApi('getUpdates', { offset: -1, timeout: 0 });
    } catch { /* expected if another instance already got the 409 */ }

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await telegraf.launch({ allowedUpdates: [] });
        return;
      } catch (err) {
        const code = err?.response?.error_code || err?.code;
        if (code === 409 && attempt < maxRetries) {
          const delay = Math.min(1000 * 2 ** attempt, 30_000);
          this.logger.warn(`409 Conflict on launch (attempt ${attempt}), retrying in ${delay}ms...`);
          await new Promise(r => setTimeout(r, delay));
          continue;
        }
        throw err;
      }
    }
  }

  async startBot(botRecord: Bot): Promise<void> {
    if (this.instances.has(botRecord.id)) {
      const inst = this.instances.get(botRecord.id);
      if (inst.isRunning) {
        this.logger.warn(`Bot ${botRecord.name} is already running`);
        return;
      }
    }

    const telegraf = new Telegraf(botRecord.token);

    // ── Universal logging middleware ────────────────────────────────────────
    telegraf.use(async (ctx: Context, next) => {
      const start = Date.now();
      try {
        await this.logsService.logUpdate(botRecord.id, ctx.update);
        this.botsService.incrementMessageCount(botRecord.id);
        this.eventEmitter.emit('update.received', { botId: botRecord.id, update: ctx.update });
      } catch (err) {
        this.logger.error(`Log middleware error for bot ${botRecord.name}: ${err.message}`);
      }
      try {
        await this.upsertKnownChat(botRecord.id, ctx.update);
      } catch (err) {
        this.logger.error(`Failed to upsert known chat for bot ${botRecord.name}: ${err.message}`);
      }
      await next();
    });

    // ── Global error handler ────────────────────────────────────────────────
    telegraf.catch(async (err: any, ctx: Context) => {
      const msg = err?.message || String(err);
      this.logger.error(`Bot ${botRecord.name} error: ${msg}`, err?.stack);

      const instance = this.instances.get(botRecord.id);
      if (instance) {
        instance.errorCount++;
        instance.lastError = msg;
      }

      await this.logsService.logError(botRecord.id, 'error', msg, err?.stack, {
        updateType: Object.keys(ctx.update || {})[1],
        userId: ctx.from?.id,
      });

      // Send alert to configured chat
      if (botRecord.alertChatId) {
        await this.alertsService.sendAlert(botRecord, `🚨 *Error*\n\`${msg}\``);
      }
    });

    const instance: BotInstance = {
      bot: telegraf,
      botRecord,
      isRunning: false,
      startedAt: null,
      errorCount: 0,
      lastError: null,
    };

    this.instances.set(botRecord.id, instance);

    // Launch in long-polling mode with retry on 409 Conflict
    this.launchWithRetry(telegraf)
      .then(() => {
        this.logger.log(`Bot ${botRecord.name} stopped`);
        instance.isRunning = false;
      })
      .catch(async (err) => {
        const msg = err?.message || String(err);
        this.logger.error(`Bot ${botRecord.name} launch failed: ${msg}`);
        instance.isRunning = false;
        instance.lastError = msg;

        await this.logsService.logError(botRecord.id, 'error', `Launch failed: ${msg}`, err?.stack);
        if (botRecord.alertChatId) {
          await this.alertsService.sendAlert(botRecord, `🔴 *Bot stopped*\n\`${msg}\``);
        }
      });

    instance.isRunning = true;
    instance.startedAt = new Date();
    this.logger.log(`Bot started: ${botRecord.name} (${botRecord.id})`);

    await this.logsService.logError(botRecord.id, 'info', `Bot started: ${botRecord.name}`);
    if (botRecord.alertChatId) {
      await this.alertsService.sendAlert(botRecord, `✅ *Bot started*: ${botRecord.name}`);
    }
  }

  async stopBot(botId: string): Promise<void> {
    const instance = this.instances.get(botId);
    if (!instance) return;

    try {
      instance.bot.stop('Manual stop');
    } catch (_) {}

    instance.isRunning = false;
    this.instances.delete(botId);
    this.logger.log(`Bot stopped: ${instance.botRecord.name}`);

    await this.logsService.logError(botId, 'info', `Bot stopped: ${instance.botRecord.name}`);
  }

  async restartBot(botId: string): Promise<void> {
    const instance = this.instances.get(botId);
    if (!instance) return;
    const record = instance.botRecord;
    await this.stopBot(botId);
    // Refresh record from DB
    const fresh = await this.botsService.findOne(botId);
    await this.startBot(fresh);
  }

  getStatus(botId: string): Partial<BotInstance> | null {
    const inst = this.instances.get(botId);
    if (!inst) return null;
    return {
      isRunning: inst.isRunning,
      startedAt: inst.startedAt,
      errorCount: inst.errorCount,
      lastError: inst.lastError,
    };
  }

  getAllStatuses(): Record<string, Partial<BotInstance>> {
    const result: Record<string, Partial<BotInstance>> = {};
    for (const [id, inst] of this.instances) {
      result[id] = {
        isRunning: inst.isRunning,
        startedAt: inst.startedAt,
        errorCount: inst.errorCount,
        lastError: inst.lastError,
      };
    }
    return result;
  }

  getBotInstance(botId: string): BotInstance {
    const instance = this.instances.get(botId);
    if (!instance) {
      throw new NotFoundException(`Bot ${botId} not found in registry`);
    }
    return instance;
  }

  getTelegram(botId: string): Telegraf {
    return this.getBotInstance(botId).bot;
  }

  assertBotRunning(botId: string): void {
    const instance = this.getBotInstance(botId);
    if (!instance.isRunning) {
      throw new ConflictException(`Bot ${instance.botRecord.name} is not running`);
    }
  }

  private async upsertKnownChat(botId: string, update: any): Promise<void> {
    const extractChat = (u: any) =>
      u.message?.chat ?? u.edited_message?.chat ?? u.channel_post?.chat ??
      u.edited_channel_post?.chat ?? u.callback_query?.message?.chat ??
      u.my_chat_member?.chat ?? u.chat_member?.chat ?? null;

    const chat = extractChat(update);
    if (!chat || chat.id === undefined) return;

    const now = Date.now();
    const updateId = update.update_id;

    const existing = this.dbService.db
      .select()
      .from(knownChats)
      .where(and(eq(knownChats.botId, botId), eq(knownChats.chatId, chat.id)))
      .get();

    if (existing) {
      this.dbService.db
        .update(knownChats)
        .set({
          chatType: chat.type ?? existing.chatType,
          title: chat.title ?? existing.title,
          username: chat.username ?? existing.username,
          firstName: chat.first_name ?? existing.firstName,
          lastName: chat.last_name ?? existing.lastName,
          lastMessageAt: now,
          lastUpdateId: updateId,
          updatedAt: now,
        })
        .where(eq(knownChats.id, existing.id))
        .run();
    } else {
      this.dbService.db
        .insert(knownChats)
        .values({
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
        })
        .run();
    }
  }

  async onModuleDestroy() {
    this.logger.log('Stopping all bots...');
    for (const [id] of this.instances) {
      await this.stopBot(id);
    }
  }
}
