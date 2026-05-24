import { IsString, IsOptional, IsIn } from 'class-validator';

export class CreateBroadcastDto {
  @IsOptional()
  @IsString()
  botId?: string;

  @IsString()
  title: string;

  @IsIn(['text', 'photo', 'video', 'animation', 'audio', 'voice', 'document', 'sticker'])
  messageType: string;

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
  @IsString()
  filtersJson?: string;
}
