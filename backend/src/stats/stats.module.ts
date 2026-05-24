import { Module } from '@nestjs/common';
import { StatsController } from './stats.controller';
import { StatsService } from './stats.service';
import { LogsModule } from '../logs/logs.module';
import { BotsModule } from '../bots/bots.module';

@Module({
  imports: [LogsModule, BotsModule],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
