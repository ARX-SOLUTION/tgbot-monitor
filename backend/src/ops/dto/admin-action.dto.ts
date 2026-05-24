import { IsString, IsOptional, IsIn, IsObject } from 'class-validator';

const ALLOWED_ACTIONS = [
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
];

export class AdminActionDto {
  @IsString()
  botId: string;

  @IsString()
  chatId: string;

  @IsIn(ALLOWED_ACTIONS)
  action: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, any>;
}
