import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class SendMessageDto {
  @IsString()
  botId: string;

  @IsString()
  chatId: string;

  @IsIn(['text', 'photo', 'video', 'animation', 'audio', 'voice', 'document'])
  type: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  mediaFileId?: string;

  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @IsOptional()
  @IsNumber()
  replyToMessageId?: number;

  @IsOptional()
  @IsIn(['HTML', 'MarkdownV2'])
  parseMode?: string;
}
