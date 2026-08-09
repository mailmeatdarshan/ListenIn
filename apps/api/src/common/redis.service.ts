import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  public client: Redis | null = null;
  public isConnected: boolean = false;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url && process.env.NODE_ENV === 'production') {
      console.warn('REDIS_URL not set in production. Falling back to in-memory presence mode.');
      return;
    }

    const redisUrl = url || 'redis://localhost:6379';
    try {
      this.client = new Redis(redisUrl, {
        retryStrategy: (times) => {
          if (times > 2) {
            console.warn('Redis connection limit reached. Falling back to in-memory storage.');
            return null; // Stop retrying
          }
          return Math.min(times * 100, 1000);
        },
        maxRetriesPerRequest: 1,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        console.warn('Redis warning (in-memory fallback active):', err.message);
      });
    } catch (e) {
      console.warn('Failed to initialize Redis client. In-memory fallback active.');
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
