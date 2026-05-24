import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AlertsService } from './alerts.service';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class SendAlertDto {
  @ApiProperty() @IsString() @IsNotEmpty() token: string;
  @ApiProperty() @IsString() @IsNotEmpty() chatId: string;
  @ApiProperty() @IsString() @IsNotEmpty() message: string;
}

@ApiTags('alerts')
@Controller('api/alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post('test')
  @ApiOperation({ summary: 'Send a test alert to a Telegram chat' })
  async sendTest(@Body() dto: SendAlertDto) {
    const ok = await this.alertsService.sendRawAlert(dto.token, dto.chatId, `🔔 *Test alert*\n${dto.message}`);
    return { success: ok };
  }
}
