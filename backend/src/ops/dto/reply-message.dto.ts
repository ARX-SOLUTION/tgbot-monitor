import { IsString, IsOptional, IsNumber, IsIn } from 'class-validator';

export class ReplyMessageDto {
  @IsString()
  botId: string;

  @IsString()
  chatId: string;

  @IsNumber()
  messageId: number;

  @IsIn(['text', 'photo', 'video', 'animation', 'audio', 'voice', 'document', 'sticker'])
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
  @IsIn(['HTML', 'MarkdownV2'])
  parseMode?: string;
}
