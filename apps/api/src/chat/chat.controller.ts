import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('chat')
@UseGuards(AuthGuard)
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get(':roomId')
  async getRecentMessages(@Param('roomId') roomId: string) {
    const messages = await this.chatService.getRecentMessages(roomId);
    // Reverse to return chronological order
    return messages.reverse();
  }
}
