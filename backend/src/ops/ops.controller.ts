import { Controller, Get, Post, Param, Query, Body, HttpCode, HttpStatus, UsePipes, ValidationPipe } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OpsService } from './ops.service';
import { SendMessageDto } from './dto/send-message.dto';
import { ReplyMessageDto } from './dto/reply-message.dto';
import { CreateBroadcastDto } from './dto/create-broadcast.dto';
import { AdminChatActionDto } from './dto/admin-chat-action.dto';
import { GetChatsDto } from './dto/get-chats.dto';

@ApiTags('ops')
@Controller('api/ops')
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }))
export class OpsController {
  constructor(private readonly opsService: OpsService) {}

  @Get('chats')
  @ApiOperation({ summary: 'List known chats' })
  getChats(@Query() query: GetChatsDto) {
    // DTO validation and whitelisting handled by ValidationPipe
    return this.opsService.getChats({
      botId: query.botId,
      chatType: query.chatType,
      search: query.search,
      canSend: query.canSend ? query.canSend === 'true' : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      offset: query.offset ? parseInt(query.offset) : undefined,
    });
  }

  @Get('chats/:chatId')
  @ApiOperation({ summary: 'Get known chat by ID' })
  getChat(@Param('chatId') chatId: string) {
    return this.opsService.getChat(parseInt(chatId));
  }

  @Post('chats/:chatId/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh known chat' })
  refreshChat(@Param('chatId') chatId: string) {
    return this.opsService.refreshChat(parseInt(chatId));
  }

  @Post('messages/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message to a chat' })
  sendMessage(@Body() dto: SendMessageDto) {
    // Audit logging stub
    // this.auditService.log('sendMessage', dto);
    return this.opsService.sendMessage(dto);
  }

  @Post('messages/reply')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reply to a message' })
  replyMessage(@Body() dto: ReplyMessageDto) {
    // Audit logging stub
    // this.auditService.log('replyMessage', dto);
    return this.opsService.replyMessage(dto);
  }

  @Get('outbound')
  @ApiOperation({ summary: 'List outbound messages' })
  getOutbound(
    @Query('botId') botId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.opsService.getOutboundMessages({
      botId,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Post('broadcasts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a broadcast job' })
  createBroadcast(@Body() dto: CreateBroadcastDto) {
    // Audit logging stub
    // this.auditService.log('createBroadcast', dto);
    return this.opsService.createBroadcast(dto);
  }

  @Get('broadcasts')
  @ApiOperation({ summary: 'List broadcast jobs' })
  getBroadcasts(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.opsService.getBroadcasts({
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }

  @Get('broadcasts/:id')
  @ApiOperation({ summary: 'Get broadcast job with targets' })
  getBroadcast(@Param('id') id: string) {
    return this.opsService.getBroadcast(parseInt(id));
  }

  @Post('broadcasts/:id/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Start a broadcast job' })
  startBroadcast(@Param('id') id: string) {
    return this.opsService.startBroadcast(parseInt(id));
  }

  @Post('broadcasts/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a broadcast job' })
  cancelBroadcast(@Param('id') id: string) {
    return this.opsService.cancelBroadcast(parseInt(id));
  }

  @Post('admin/chat-action')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute a chat admin action' })
  chatAction(@Body() dto: AdminChatActionDto) {
    // Audit logging stub
    // this.auditService.log('chatAction', dto);
    return this.opsService.chatAction(dto);
  }

  @Get('audit')
  @ApiOperation({ summary: 'List audit logs' })
  getAudit(
    @Query('botId') botId?: string,
    @Query('action') action?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    // Audit logging stub (read)
    // this.auditService.log('getAudit', { botId, action, status });
    return this.opsService.getAuditLogs({
      botId,
      action,
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });
  }
}

