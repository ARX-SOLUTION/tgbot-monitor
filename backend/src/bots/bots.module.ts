import { Module } from '@nestjs/common';
import { BotsService } from './bots.service';
import { BotsController } from './bots.controller';
import { BotRegistryService } from './bot-registry.service';
import { LogsModule } from '../logs/logs.module';
import { AlertsModule } from '../alerts/alerts.module';

@Module({
  imports: [LogsModule, AlertsModule],
  providers: [BotsService, BotRegistryService],
  controllers: [BotsController],
  exports: [BotsService, BotRegistryService],
})
export class BotsModule {}
