import { IsBoolean, IsIn, IsNotEmpty, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

const ALLOWED_ADMIN_ACTIONS = [
  'getChat',
  'getChatAdministrators',
  'banChatMember',
  'unbanChatMember',
  'restrictChatMember',
  'promoteChatMember',
  'setChatTitle',
  'setChatDescription',
  'pinChatMessage',
  'unpinChatMessage',
  'deleteMessage',
  'createChatInviteLink',
] as const;

export class AdminChatActionDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_ADMIN_ACTIONS)
  action: typeof ALLOWED_ADMIN_ACTIONS[number];

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  confirm?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  reason?: string;
}
