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
  constructor(private redis: RedisService) {}

  async setUserPresence(roomId: string, userId: string, username: string, socketId: string, micOn: boolean = false) {
    const key = `room:${roomId}:presence`;
    const presence: PresenceInfo = {
      userId,
      username,
      socketId,
      online: true,
      micOn,
      lastSeen: Date.now(),
    };
    
    await this.redis.client.hset(key, userId, JSON.stringify(presence));
    await this.redis.client.expire(key, 86400);
  }

  async removeUserPresence(roomId: string, userId: string) {
    const key = `room:${roomId}:presence`;
    await this.redis.client.hdel(key, userId);
  }

  async getRoomPresence(roomId: string): Promise<PresenceInfo[]> {
    const key = `room:${roomId}:presence`;
    const data = await this.redis.client.hgetall(key);
    
    return Object.values(data).map(val => JSON.parse(val));
  }
}
