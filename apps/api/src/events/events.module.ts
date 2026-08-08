import { Module } from '@nestjs/common';
import { EventsGateway } from './events.gateway';
import { AuthModule } from '../auth/auth.module';
import { PresenceModule } from '../presence/presence.module';
import { ChatModule } from '../chat/chat.module';
import { RoomsModule } from '../rooms/rooms.module';
import { QueueModule } from '../queue/queue.module';
import { SpotifyModule } from '../spotify/spotify.module';

@Module({
  imports: [AuthModule, PresenceModule, ChatModule, RoomsModule, QueueModule, SpotifyModule],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class EventsModule {}
