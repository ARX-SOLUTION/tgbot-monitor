import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { BotsModule } from './bots/bots.module';
import { LogsModule } from './logs/logs.module';
import { AlertsModule } from './alerts/alerts.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    EventEmitterModule.forRoot({ wildcard: true, maxListeners: 20 }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    BotsModule,
    LogsModule,
    AlertsModule,
    StatsModule,
  ],
})
export class AppModule {}
