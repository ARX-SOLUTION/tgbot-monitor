import { IsString, IsNotEmpty, IsOptional, IsNumber, IsObject } from 'class-validator';

export class AdminChatActionDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  action: string; // e.g. 'ban', 'unban', 'mute', etc.

  @IsOptional()
  @IsObject()
  params?: Record<string, any>;
}
