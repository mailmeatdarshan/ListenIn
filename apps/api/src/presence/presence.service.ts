import { Injectable } from '@nestjs/common';
import { RedisService } from '../common/redis.service';

export interface PresenceInfo {
  userId: string;
  username: string;
  socketId: string;
  online: boolean;
  micOn: boolean;
  lastSeen: number;
}

@Injectable()
export class PresenceService {
  private inMemoryPresence: Map<string, Map<string, PresenceInfo>> = new Map();

  constructor(private redis: RedisService) {}

  async setUserPresence(roomId: string, userId: string, username: string, socketId: string, micOn: boolean = false) {
    const presence: PresenceInfo = {
      userId,
      username,
      socketId,
      online: true,
      micOn,
      lastSeen: Date.now(),
    };

    if (this.redis.client && this.redis.isConnected) {
      try {
        const key = `room:${roomId}:presence`;
        await this.redis.client.hset(key, userId, JSON.stringify(presence));
        await this.redis.client.expire(key, 86400);
        return;
      } catch (e) {
        // Fallback to in-memory on error
      }
    }

    if (!this.inMemoryPresence.has(roomId)) {
      this.inMemoryPresence.set(roomId, new Map());
    }
    this.inMemoryPresence.get(roomId)!.set(userId, presence);
  }

  async removeUserPresence(roomId: string, userId: string) {
    if (this.redis.client && this.redis.isConnected) {
      try {
        const key = `room:${roomId}:presence`;
        await this.redis.client.hdel(key, userId);
      } catch (e) {}
    }

    if (this.inMemoryPresence.has(roomId)) {
      this.inMemoryPresence.get(roomId)!.delete(userId);
    }
  }

  async getRoomPresence(roomId: string): Promise<PresenceInfo[]> {
    if (this.redis.client && this.redis.isConnected) {
      try {
        const key = `room:${roomId}:presence`;
        const data = await this.redis.client.hgetall(key);
        if (data && Object.keys(data).length > 0) {
          return Object.values(data).map(val => JSON.parse(val));
        }
      } catch (e) {}
    }

    const roomMap = this.inMemoryPresence.get(roomId);
    if (!roomMap) return [];
    return Array.from(roomMap.values());
  }
}
