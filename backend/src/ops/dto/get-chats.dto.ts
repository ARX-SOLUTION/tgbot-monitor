import { IsOptional, IsString, IsBooleanString, IsNumberString } from 'class-validator';

export class GetChatsDto {
  @IsOptional()
  @IsString()
  botId?: string;

  @IsOptional()
  @IsString()
  chatType?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBooleanString()
  canSend?: string;

  @IsOptional()
  @IsNumberString()
  limit?: string;

  @IsOptional()
  @IsNumberString()
  offset?: string;
}
