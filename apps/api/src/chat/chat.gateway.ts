import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { AuthService } from '../auth/auth.service';

@WebSocketGateway({ cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private chatService: ChatService,
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

  @SubscribeMessage('chat:message')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; type?: 'TEXT' | 'VOICE_NOTE' },
  ) {
    if (!client.data.user) return;
    
    const userId = client.data.user.sub;
    const message = await this.chatService.saveMessage({
      roomId: data.roomId,
      userId,
      content: data.content,
      type: data.type || 'TEXT',
    });

    this.server.to(data.roomId).emit('chat:message', message);
  }

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user) return;
    client.to(data.roomId).emit('chat:typing', { userId: client.data.user.sub });
  }

  @SubscribeMessage('chat:stop-typing')
  handleStopTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user) return;
    client.to(data.roomId).emit('chat:stop-typing', { userId: client.data.user.sub });
  }
}
