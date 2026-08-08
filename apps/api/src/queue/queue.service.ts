import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface AddSuggestionDto {
  roomId: string;
  userId: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  audioUrl?: string;
  sourceUrl?: string;
  duration?: number;
}

@Injectable()
export class QueueService {
  constructor(private prisma: PrismaService) {}

  async addSuggestion(data: AddSuggestionDto) {
    return this.prisma.queueSuggestion.create({
      data: {
        roomId: data.roomId,
        suggestedBy: data.userId,
        title: data.title,
        artist: data.artist || 'Unknown Artist',
        coverUrl: data.coverUrl || '',
        audioUrl: data.audioUrl || '',
        sourceUrl: data.sourceUrl || '',
        duration: data.duration || 180,
        status: 'PENDING',
      },
      include: {
        suggestedByUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async getPendingSuggestions(roomId: string) {
    return this.prisma.queueSuggestion.findMany({
      where: { roomId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      include: {
        suggestedByUser: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
  }

  async removeSuggestion(id: string) {
    return this.prisma.queueSuggestion.delete({
      where: { id },
    });
  }

  async markPlayed(id: string) {
    return this.prisma.queueSuggestion.update({
      where: { id },
      data: { status: 'PLAYED' },
    });
  }
}
