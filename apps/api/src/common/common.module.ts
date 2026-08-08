import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { LivekitService } from './livekit.service';

@Global()
@Module({
  providers: [PrismaService, RedisService, LivekitService],
  exports: [PrismaService, RedisService, LivekitService],
})
export class CommonModule {}
