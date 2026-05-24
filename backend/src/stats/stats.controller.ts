import { Controller, Get, Param, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { StatsService } from './stats.service';

@ApiTags('stats')
@Controller('api/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Global dashboard overview — totals across all bots' })
  async overview() {
    return this.statsService.getOverview();
  }

  @Get('bots/:botId')
  @ApiOperation({ summary: 'Per-bot summary statistics' })
  async botSummary(@Param('botId') botId: string) {
    return this.statsService.getBotSummary(botId);
  }

  @Get('activity')
  @ApiOperation({ summary: 'Recent activity feed (all bots)' })
  async recentActivity(
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    return this.statsService.getRecentActivity(limit);
  }

  @Get('message-rate')
  @ApiOperation({ summary: 'Message rate per hour, per bot' })
  async messageRate(
    @Query('hours', new DefaultValuePipe(24), ParseIntPipe) hours: number,
  ) {
    return this.statsService.getMessageRate(hours);
  }
}
