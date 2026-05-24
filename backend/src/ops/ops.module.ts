import { Module } from '@nestjs/common';
import { OpsController } from './ops.controller';
import { OpsService } from './ops.service';
import { BotsModule } from '../bots/bots.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [BotsModule, LogsModule],
  controllers: [OpsController],
  providers: [OpsService],
  exports: [OpsService],
})
export class OpsModule {}
