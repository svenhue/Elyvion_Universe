import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { envelope } from '@elyvion/shared';
import { ChatService } from './chat.service';
import { createConversationSchema, postMessageSchema } from './dto/chat.dto';

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post('conversations')
  async create(@Body() body: unknown) {
    const parsed = createConversationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.chat.createConversation(parsed.data));
  }

  @Get('conversations')
  async list() {
    return envelope(await this.chat.listConversations());
  }

  @Get('conversations/:id/messages')
  async listMessages(@Param('id') id: string) {
    return envelope(await this.chat.listMessages(id));
  }

  @Post('conversations/:id/messages')
  async postMessage(@Param('id') id: string, @Body() body: unknown) {
    const parsed = postMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.issues);
    }
    return envelope(await this.chat.postMessage(id, parsed.data.content));
  }
}
