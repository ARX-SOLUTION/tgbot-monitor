import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateBotDto {
  @ApiProperty({ description: 'Friendly name for the bot', example: 'My Support Bot' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Telegram bot token from @BotFather', example: '123456:ABC-DEF...' })
  @IsString()
  @IsNotEmpty()
  @MinLength(40)
  token: string;

  @ApiPropertyOptional({ description: 'Telegram chat ID to receive alerts for this bot' })
  @IsOptional()
  @IsString()
  alertChatId?: string;

  @ApiPropertyOptional({ description: 'Human-readable description of what this bot does' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Webhook URL (if using webhook mode)' })
  @IsOptional()
  @IsString()
  webhookUrl?: string;
}
