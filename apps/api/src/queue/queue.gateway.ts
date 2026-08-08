import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { QueueService } from './queue.service';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class QueueGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private queueService: QueueService,
    private authService: AuthService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token || client.handshake.headers['authorization'];
    if (token) {
      const parsed = token.replace('Bearer ', '');
      const user = this.authService.verifyToken(parsed);
      if (user) {
        client.data.user = user;
      }
    }
  }

  @SubscribeMessage('queue:suggest')
  async handleSuggest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; title: string; sourceUrl?: string },
  ) {
    if (!client.data.user) return;
    
    const userId = client.data.user.sub;
    const suggestion = await this.queueService.addSuggestion({
      roomId: data.roomId,
      userId,
      title: data.title,
      sourceUrl: data.sourceUrl,
    });

    this.server.to(data.roomId).emit('queue:suggestion_added', suggestion);
  }
}
