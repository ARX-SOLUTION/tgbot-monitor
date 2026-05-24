import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { BotsService } from './bots.service';
import { BotRegistryService } from './bot-registry.service';
import { CreateBotDto } from './dto/create-bot.dto';
import { UpdateBotDto } from './dto/update-bot.dto';

@ApiTags('bots')
@Controller('api/bots')
export class BotsController {
  constructor(
    private readonly botsService: BotsService,
    private readonly registry: BotRegistryService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all registered bots with runtime status' })
  async findAll() {
    const bots = await this.botsService.findAll();
    const statuses = this.registry.getAllStatuses();
    return bots.map((b) => ({
      ...b,
      runtime: statuses[b.id] ?? { isRunning: false, startedAt: null, errorCount: 0 },
    }));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get bot details by ID' })
  async findOne(@Param('id') id: string) {
    const bot = await this.botsService.findOne(id);
    return { ...bot, runtime: this.registry.getStatus(id) };
  }

  @Post()
  @ApiOperation({ summary: 'Register a new bot' })
  @ApiResponse({ status: 201, description: 'Bot registered and started' })
  async create(@Body() dto: CreateBotDto) {
    const bot = await this.botsService.create(dto);
    // Auto-start
    try {
      await this.registry.startBot(bot);
    } catch (err) {}
    return { ...bot, runtime: this.registry.getStatus(bot.id) };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update bot configuration' })
  async update(@Param('id') id: string, @Body() dto: UpdateBotDto) {
    return this.botsService.update(id, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Start a bot' })
  @HttpCode(HttpStatus.OK)
  async start(@Param('id') id: string) {
    const bot = await this.botsService.findOne(id);
    await this.registry.startBot(bot);
    await this.botsService.setActive(id, true);
    return { message: 'Bot started', status: this.registry.getStatus(id) };
  }

  @Post(':id/stop')
  @ApiOperation({ summary: 'Stop a running bot' })
  @HttpCode(HttpStatus.OK)
  async stop(@Param('id') id: string) {
    await this.registry.stopBot(id);
    await this.botsService.setActive(id, false);
    return { message: 'Bot stopped' };
  }

  @Post(':id/restart')
  @ApiOperation({ summary: 'Restart a bot (stop + start)' })
  @HttpCode(HttpStatus.OK)
  async restart(@Param('id') id: string) {
    await this.registry.restartBot(id);
    return { message: 'Bot restarted', status: this.registry.getStatus(id) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remove a bot permanently' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.registry.stopBot(id);
    await this.botsService.remove(id);
  }
}
