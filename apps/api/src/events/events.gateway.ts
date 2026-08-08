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
import { AuthService } from '../auth/auth.service';
import { PresenceService } from '../presence/presence.service';
import { ChatService } from '../chat/chat.service';
import { RoomsService } from '../rooms/rooms.service';
import { QueueService } from '../queue/queue.service';
import { SpotifyService } from '../spotify/spotify.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // Track room relay state & host socket id per room
  private roomRelayState: Map<string, { isRelaying: boolean; hostSocketId: string | null; hostId: string | null }> = new Map();

  constructor(
    private authService: AuthService,
    private presenceService: PresenceService,
    private chatService: ChatService,
    private roomsService: RoomsService,
    private queueService: QueueService,
    private spotifyService: SpotifyService,
  ) {}

  async handleConnection(client: Socket) {
    const token = client.handshake.auth?.token || client.handshake.headers?.['authorization'];
    if (!token) return;

    const parsedToken = token.replace('Bearer ', '');
    const user = this.authService.verifyToken(parsedToken);
    if (!user) return;

    client.data.user = user;
  }

  async handleDisconnect(client: Socket) {
    if (client.data.roomId && client.data.user) {
      const roomId = client.data.roomId;
      const userId = client.data.user.sub;

      await this.presenceService.removeUserPresence(roomId, userId);

      const state = this.roomRelayState.get(roomId);
      // ONLY IF THE HOST DISCONNECTS -> PAUSE RELAY
      if (state && state.hostId === userId) {
        state.isRelaying = false;
        state.hostSocketId = null;
        this.server.to(roomId).emit('relay:stop', { hostId: userId });
      }

      const presence = await this.presenceService.getRoomPresence(roomId);
      this.server.to(roomId).emit('room:presence', presence);
    }
  }

  @SubscribeMessage('room:join')
  async handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user || !data?.roomId) return;
    
    const { roomId } = data;
    const userId = client.data.user.sub;
    const username = client.data.user.username || 'User';
    
    client.join(roomId);
    client.data.roomId = roomId;

    const room = await this.roomsService.getRoomDetails(roomId, userId).catch(() => null);
    const isHost = room ? room.hostId === userId : false;

    if (isHost) {
      const currentState = this.roomRelayState.get(roomId) || { isRelaying: false, hostSocketId: client.id, hostId: userId };
      currentState.hostSocketId = client.id;
      currentState.hostId = userId;
      this.roomRelayState.set(roomId, currentState);
    }

    await this.presenceService.setUserPresence(roomId, userId, username, client.id);
    const presence = await this.presenceService.getRoomPresence(roomId);
    
    // Send presence both to whole room and directly to joining socket
    this.server.to(roomId).emit('room:presence', presence);
    client.emit('room:presence', presence);

    // Sync relay status to newly joined user
    const relayState = this.roomRelayState.get(roomId);
    if (relayState && relayState.isRelaying) {
      client.emit('relay:status', { isRelaying: true, hostSocketId: relayState.hostSocketId });
      
      // Request Host to generate WebRTC offer for this new socket
      if (relayState.hostSocketId) {
        this.server.to(relayState.hostSocketId).emit('webrtc:request-offer', {
          listenerSocketId: client.id,
          roomId,
        });
      }
    } else {
      client.emit('relay:status', { isRelaying: false });
    }
  }

  @SubscribeMessage('room:leave')
  async handleLeaveRoom(@ConnectedSocket() client: Socket) {
    if (!client.data.user || !client.data.roomId) return;
    
    const roomId = client.data.roomId;
    const userId = client.data.user.sub;
    
    client.leave(roomId);
    client.data.roomId = null;

    await this.presenceService.removeUserPresence(roomId, userId);

    const state = this.roomRelayState.get(roomId);
    // ONLY IF THE HOST LEAVES -> PAUSE RELAY
    if (state && state.hostId === userId) {
      state.isRelaying = false;
      state.hostSocketId = null;
      this.server.to(roomId).emit('relay:stop', { hostId: userId });
    }

    const presence = await this.presenceService.getRoomPresence(roomId);
    this.server.to(roomId).emit('room:presence', presence);
  }

  @SubscribeMessage('room:delete')
  async handleDeleteRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user || !data?.roomId) return;
    const userId = client.data.user.sub;

    try {
      await this.roomsService.deleteRoom(data.roomId, userId);
      this.roomRelayState.delete(data.roomId);
      this.server.to(data.roomId).emit('room:closed', { reason: 'Room was deleted by host.' });
    } catch (e: any) {
      client.emit('error', { message: e.message });
    }
  }

  @SubscribeMessage('chat:message')
  @SubscribeMessage('chat:send')
  async handleMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string; type?: 'TEXT' | 'VOICE_NOTE' },
  ) {
    if (!data?.roomId || !data?.content) return;

    let user = client.data.user;
    if (!user) {
      const token = client.handshake.auth?.token || client.handshake.headers?.['authorization'];
      if (token) {
        const parsed = token.replace('Bearer ', '');
        user = this.authService.verifyToken(parsed);
        if (user) {
          client.data.user = user;
        }
      }
    }

    if (!user) {
      console.warn(`Unauthenticated socket ${client.id} attempted to send message`);
      return;
    }
    
    client.join(data.roomId);

    const message = await this.chatService.saveMessage({
      roomId: data.roomId,
      userId: user.sub,
      content: data.content,
      type: data.type || 'TEXT',
    });

    this.server.to(data.roomId).emit('chat:message', message);
  }

  @SubscribeMessage('room:reaction')
  @SubscribeMessage('reaction')
  handleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; emoji: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.emoji) return;

    const userId = client.data.user.sub;
    const username = client.data.user.username || 'User';

    this.server.to(data.roomId).emit('room:reaction', {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      userId,
      username,
      emoji: data.emoji,
      timestamp: Date.now(),
    });
  }

  @SubscribeMessage('room:update_track')
  handleUpdateTrack(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; title: string; artist?: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.title) return;
    this.server.to(data.roomId).emit('room:track_updated', {
      title: data.title,
      artist: data.artist || 'Live Host',
    });
  }

  @SubscribeMessage('room:tab_preview')
  handleTabPreview(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; thumbnail: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.thumbnail) return;
    // Relay to everyone in room EXCEPT the sender (host already has live video)
    client.to(data.roomId).emit('room:tab_preview', {
      thumbnail: data.thumbnail,
    });
  }

  @SubscribeMessage('room:theme_change')
  handleThemeChange(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; theme: any },
  ) {
    if (!client.data.user || !data?.roomId || !data?.theme) return;
    this.server.to(data.roomId).emit('room:theme_updated', data.theme);
  }

  @SubscribeMessage('queue:get')
  async handleQueueGet(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data?.roomId) return;
    const items = await this.queueService.getPendingSuggestions(data.roomId);
    client.emit('queue:updated', items);
  }

  @SubscribeMessage('queue:add')
  async handleQueueAdd(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; title: string; artist?: string; coverUrl?: string; sourceUrl?: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.title) return;

    // Resolve audio stream URL if not provided
    let audioUrl = '';
    try {
      audioUrl = await this.spotifyService.resolveAudioStream(data.title, data.artist || '');
    } catch (e) {}

    const item = await this.queueService.addSuggestion({
      roomId: data.roomId,
      userId: client.data.user.sub,
      title: data.title,
      artist: data.artist || 'Unknown Artist',
      coverUrl: data.coverUrl || '',
      audioUrl,
      sourceUrl: data.sourceUrl || '',
    });

    const pending = await this.queueService.getPendingSuggestions(data.roomId);
    this.server.to(data.roomId).emit('queue:updated', pending);
    this.server.to(data.roomId).emit('queue:item_added', item);
  }

  @SubscribeMessage('queue:remove')
  async handleQueueRemove(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; suggestionId: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.suggestionId) return;

    try {
      await this.queueService.removeSuggestion(data.suggestionId);
    } catch (e) {}

    const pending = await this.queueService.getPendingSuggestions(data.roomId);
    this.server.to(data.roomId).emit('queue:updated', pending);
  }

  @SubscribeMessage('queue:next')
  async handleQueueNext(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user || !data?.roomId) return;

    const pending = await this.queueService.getPendingSuggestions(data.roomId);
    if (pending.length === 0) return;

    const currentTrack = pending[0];
    await this.queueService.markPlayed(currentTrack.id);

    // Resolve audio URL if missing
    let audioUrl = currentTrack.audioUrl;
    if (!audioUrl) {
      audioUrl = await this.spotifyService.resolveAudioStream(currentTrack.title, currentTrack.artist || '');
    }

    const updatedPending = await this.queueService.getPendingSuggestions(data.roomId);
    this.server.to(data.roomId).emit('queue:updated', updatedPending);

    // Broadcast track play event to all room members
    this.server.to(data.roomId).emit('track:play_synced', {
      id: currentTrack.id,
      title: currentTrack.title,
      artist: currentTrack.artist || 'Spotify Queue Track',
      coverUrl: currentTrack.coverUrl || '',
      audioUrl: audioUrl,
      startedAt: Date.now(),
    });
  }

  @SubscribeMessage('webrtc:request-offer')
  handleWebRtcRequestOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; listenerSocketId?: string },
  ) {
    if (!data?.roomId) return;

    const roomId = data.roomId;
    const listenerSocketId = data.listenerSocketId || client.id;
    const relayState = this.roomRelayState.get(roomId);

    if (relayState && relayState.isRelaying && relayState.hostSocketId) {
      // Forward the request to the host so it creates a WebRTC offer
      this.server.to(relayState.hostSocketId).emit('webrtc:request-offer', {
        listenerSocketId,
        roomId,
      });
    }
  }

  @SubscribeMessage('relay:start')
  handleRelayStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user || !data?.roomId) return;
    
    const userId = client.data.user.sub;
    
    // Check if room host
    this.roomRelayState.set(data.roomId, {
      isRelaying: true,
      hostSocketId: client.id,
      hostId: userId,
    });

    this.server.to(data.roomId).emit('relay:start', { hostId: userId, socketId: client.id });
  }

  @SubscribeMessage('relay:stop')
  handleRelayStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!client.data.user || !data?.roomId) return;

    const userId = client.data.user.sub;
    const state = this.roomRelayState.get(data.roomId);

    // SECURITY & LOGIC GUARD: ONLY HOST CAN STOP AUDIO RELAY!
    if (state && state.hostId && state.hostId !== userId) {
      console.warn(`Non-host user ${userId} attempted to stop relay in room ${data.roomId}`);
      return;
    }

    this.roomRelayState.set(data.roomId, {
      isRelaying: false,
      hostSocketId: client.id,
      hostId: userId,
    });

    this.server.to(data.roomId).emit('relay:stop', { hostId: userId });
  }

  @SubscribeMessage('webrtc:offer')
  handleWebRtcOffer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetSocketId?: string; sdp: any },
  ) {
    if (data.targetSocketId) {
      this.server.to(data.targetSocketId).emit('webrtc:offer', {
        senderSocketId: client.id,
        sdp: data.sdp,
      });
    } else {
      client.to(data.roomId).emit('webrtc:offer', {
        senderSocketId: client.id,
        sdp: data.sdp,
      });
    }
  }

  @SubscribeMessage('webrtc:answer')
  handleWebRtcAnswer(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId: string; sdp: any },
  ) {
    this.server.to(data.targetSocketId).emit('webrtc:answer', {
      senderSocketId: client.id,
      sdp: data.sdp,
    });
  }

  @SubscribeMessage('webrtc:ice-candidate')
  handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { targetSocketId?: string; roomId?: string; candidate: any },
  ) {
    if (data.targetSocketId) {
      this.server.to(data.targetSocketId).emit('webrtc:ice-candidate', {
        senderSocketId: client.id,
        candidate: data.candidate,
      });
    } else if (data.roomId) {
      client.to(data.roomId).emit('webrtc:ice-candidate', {
        senderSocketId: client.id,
        candidate: data.candidate,
      });
    }
  }

  @SubscribeMessage('audio:chunk')
  handleAudioChunk(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; chunk: string },
  ) {
    if (!client.data.user || !data?.roomId || !data?.chunk) return;
    client.to(data.roomId).emit('audio:chunk', { chunk: data.chunk });
  }
}
