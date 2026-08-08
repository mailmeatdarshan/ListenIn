import { Injectable, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { LivekitService } from '../common/livekit.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { nanoid } from 'nanoid';
import { RoomRole } from '@prisma/client';

@Injectable()
export class RoomsService {
  constructor(
    private prisma: PrismaService,
    private livekit: LivekitService,
  ) {}

  async createRoom(userId: string, dto: CreateRoomDto) {
    const inviteCode = nanoid(8);
    
    return this.prisma.room.create({
      data: {
        name: dto.name,
        hostId: userId,
        inviteCode,
        visibility: dto.visibility || 'PRIVATE',
        members: {
          create: {
            userId,
            role: RoomRole.HOST,
          },
        },
      },
      include: {
        members: true,
      }
    });
  }

  async getUserRooms(userId: string) {
    return this.prisma.room.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        host: {
          select: { id: true, username: true, avatarUrl: true },
        },
        members: true,
      },
    });
  }

  async getPublicRooms() {
    return this.prisma.room.findMany({
      where: {
        visibility: 'PUBLIC',
      },
      include: {
        host: {
          select: { id: true, username: true, avatarUrl: true },
        },
        members: {
          select: { userId: true },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRoomDetails(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      include: {
        host: {
          select: { id: true, username: true, avatarUrl: true },
        },
        members: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    const isMember = room.members.some(m => m.userId === userId);
    if (!isMember) {
      if (room.visibility === 'PUBLIC') {
        try {
          await this.prisma.roomMember.create({
            data: {
              roomId: room.id,
              userId,
              role: RoomRole.LISTENER,
            },
          });
        } catch (e) {
          // Ignore unique constraint if added concurrently
        }
        return this.prisma.room.findUnique({
          where: { id: roomId },
          include: {
            host: {
              select: { id: true, username: true, avatarUrl: true },
            },
            members: {
              include: {
                user: { select: { id: true, username: true, avatarUrl: true } },
              },
            },
          },
        });
      }
      throw new ForbiddenException('Not a member of this room');
    }

    return room;
  }

  async joinRoom(userId: string, inviteCode: string) {
    const room = await this.prisma.room.findUnique({
      where: { inviteCode },
    });

    if (!room) {
      throw new NotFoundException('Invalid invite code');
    }

    const existingMember = await this.prisma.roomMember.findUnique({
      where: {
        roomId_userId: { roomId: room.id, userId },
      },
    });

    if (existingMember) {
      throw new ConflictException('Already a member of this room');
    }

    return this.prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId,
        role: RoomRole.LISTENER,
      },
      include: {
        room: true,
      },
    });
  }

  async transferHost(roomId: string, currentHostId: string, newHostId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== currentHostId) throw new ForbiddenException('Only current host can transfer ownership');

    const targetMember = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId: newHostId } },
    });

    if (!targetMember) throw new NotFoundException('Target user is not a member of this room');

    await this.prisma.$transaction([
      this.prisma.room.update({
        where: { id: roomId },
        data: { hostId: newHostId },
      }),
      this.prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: currentHostId } },
        data: { role: RoomRole.LISTENER },
      }),
      this.prisma.roomMember.update({
        where: { roomId_userId: { roomId, userId: newHostId } },
        data: { role: RoomRole.HOST },
      }),
    ]);

    return { success: true, newHostId };
  }

  async kickMember(roomId: string, hostId: string, targetUserId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    if (room.hostId !== hostId) throw new ForbiddenException('Only host can kick members');
    if (targetUserId === hostId) throw new ForbiddenException('Host cannot kick themselves');

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId: targetUserId } },
    });

    return { success: true };
  }

  async deleteRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    
    if (!room) throw new NotFoundException();
    if (room.hostId !== userId) throw new ForbiddenException('Only host can delete room');

    await this.prisma.room.delete({ where: { id: roomId } });
    return { success: true };
  }

  async leaveRoom(roomId: string, userId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    
    if (!room) throw new NotFoundException();
    if (room.hostId === userId) throw new ForbiddenException('Host cannot leave, delete room instead');

    await this.prisma.roomMember.delete({
      where: { roomId_userId: { roomId, userId } },
    });

    return { success: true };
  }

  async getLivekitToken(roomId: string, userId: string) {
    const member = await this.prisma.roomMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
      include: { user: true },
    });

    if (!member) {
      throw new ForbiddenException('Not a member of this room');
    }

    const token = await this.livekit.generateToken(roomId, userId, member.user.username);
    return { token };
  }
}
