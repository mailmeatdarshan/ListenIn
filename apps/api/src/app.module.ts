import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { CommonModule } from './common/common.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoomsModule } from './rooms/rooms.module';
import { ChatModule } from './chat/chat.module';
import { QueueModule } from './queue/queue.module';
import { PresenceModule } from './presence/presence.module';
import { EventsModule } from './events/events.module';
import { SpotifyModule } from './spotify/spotify.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60,
      limit: 100,
    }]),
    CommonModule,
    AuthModule,
    UsersModule,
    RoomsModule,
    ChatModule,
    QueueModule,
    PresenceModule,
    EventsModule,
    SpotifyModule,
  ],
})
export class AppModule {}
