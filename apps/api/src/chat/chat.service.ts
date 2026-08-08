import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class ChatService {
  constructor(private prisma: PrismaService) {}

  async saveMessage(data: { roomId: string; userId: string; content: string; type: 'TEXT' | 'VOICE_NOTE' }) {
    return this.prisma.chatMessage.create({
      data: {
        roomId: data.roomId,
        userId: data.userId,
        content: data.content,
        type: data.type as MessageType,
      },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async getRecentMessages(roomId: string, limit = 50) {
    return this.prisma.chatMessage.findMany({
      where: { roomId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }
}
