import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { bots, Bot, InsertBot } from '../database/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@Injectable()
export class BotsService {
  private readonly logger = new Logger(BotsService.name);

  constructor(private readonly dbService: DatabaseService) {}

  get db() {
    return this.dbService.db;
  }

  async findAll(): Promise<Bot[]> {
    return this.db.select().from(bots).orderBy(desc(bots.createdAt)).all();
  }

  async findOne(id: string): Promise<Bot> {
    const bot = this.db.select().from(bots).where(eq(bots.id, id)).get();
    if (!bot) throw new NotFoundException(`Bot with id ${id} not found`);
    return bot;
  }

  async findByToken(token: string): Promise<Bot | undefined> {
    return this.db.select().from(bots).where(eq(bots.token, token)).get();
  }

  async create(dto: CreateBotDto): Promise<Bot> {
    const existing = await this.findByToken(dto.token);
    if (existing) {
      throw new ConflictException(`A bot with this token already exists: ${existing.name}`);
    }

    const now = Date.now();
    const bot: InsertBot = {
      id: uuidv4(),
      name: dto.name,
      token: dto.token,
      alertChatId: dto.alertChatId ?? null,
      description: dto.description ?? null,
      webhookUrl: dto.webhookUrl ?? null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      totalMessages: 0,
      totalUsers: 0,
      lastActivityAt: null,
    };

    const result = this.db.insert(bots).values(bot).returning().get();
    this.logger.log(`Created bot: ${result.name} (${result.id})`);
    return result;
  }

  async update(id: string, dto: UpdateBotDto): Promise<Bot> {
    await this.findOne(id); // ensure exists
    const result = this.db
      .update(bots)
      .set({ ...dto, updatedAt: Date.now() })
      .where(eq(bots.id, id))
      .returning()
      .get();
    this.logger.log(`Updated bot: ${result.name} (${result.id})`);
    return result;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    this.db.delete(bots).where(eq(bots.id, id)).run();
    this.logger.log(`Deleted bot: ${id}`);
  }

  async incrementMessageCount(botId: string): Promise<void> {
    this.db
      .update(bots)
      .set({
        totalMessages: sql`total_messages + 1`,
        lastActivityAt: Date.now(),
        updatedAt: Date.now(),
      })
      .where(eq(bots.id, botId))
      .run();
  }

  async setTotalUsers(botId: string, count: number): Promise<void> {
    this.db
      .update(bots)
      .set({ totalUsers: count, updatedAt: Date.now() })
      .where(eq(bots.id, botId))
      .run();
  }

  async setActive(id: string, isActive: boolean): Promise<Bot> {
    return this.db
      .update(bots)
      .set({ isActive, updatedAt: Date.now() })
      .where(eq(bots.id, id))
      .returning()
      .get();
  }
}
