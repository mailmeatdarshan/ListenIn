import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { UseGuards } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(
    private authService: AuthService,
    private presenceService: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth.token || client.handshake.headers['authorization'];
    if (!token) {
      client.disconnect();
      return;
    }

    const parsedToken = token.replace('Bearer ', '');
    const user = this.authService.verifyToken(parsedToken);
    
    if (!user) {
      client.disconnect();
      return;
    }

    client.data.user = user;
  }

  async handleDisconnect(client: Socket) {
    if (client.data.roomId && client.data.user) {
      await this.presenceService.removeUserPresence(client.data.roomId, client.data.user.sub);
      const presence = await this.presenceService.getRoomPresence(client.data.roomId);
      this.server.to(client.data.roomId).emit('room:presence', presence);
    }
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user) return;
    
    const { roomId } = data;
    const userId = client.data.user.sub;
    
    client.join(roomId);
    client.data.roomId = roomId;

    await this.presenceService.setUserPresence(roomId, userId, client.data.user.username || 'User', client.id);
    const presence = await this.presenceService.getRoomPresence(roomId);
    
    this.server.to(roomId).emit('room:presence', presence);
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    if (!client.data.user || !client.data.roomId) return;
    
    const roomId = client.data.roomId;
    const userId = client.data.user.sub;
    
    client.leave(roomId);
    client.data.roomId = null;

    await this.presenceService.removeUserPresence(roomId, userId);
    const presence = await this.presenceService.getRoomPresence(roomId);
    
    this.server.to(roomId).emit('room:presence', presence);
  }
}
