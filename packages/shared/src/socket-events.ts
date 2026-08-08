import type { ChatMessageWithUser, PresenceInfo, QueueSuggestion } from './types';

// ─── Event Names ──────────────────────────────────────

export const SocketEvents = {
  // Connection
  CONNECTION: 'connection',
  DISCONNECT: 'disconnect',

  // Room
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',

  // Chat
  CHAT_MESSAGE: 'chat:message',
  CHAT_NEW_MESSAGE: 'chat:new-message',
  CHAT_TYPING: 'chat:typing',
  CHAT_STOP_TYPING: 'chat:stop-typing',
  CHAT_HISTORY: 'chat:history',

  // Presence
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_LIST: 'presence:list',

  // Relay (audio)
  RELAY_STARTED: 'relay:started',
  RELAY_STOPPED: 'relay:stopped',

  // Queue (suggestions)
  QUEUE_SUGGEST: 'queue:suggest',
  QUEUE_UPDATE: 'queue:update',
  QUEUE_LIST: 'queue:list',

  // Reactions (ephemeral, no persistence)
  REACTION: 'reaction',

  // Errors
  ERROR: 'error',
} as const;

// ─── Event Payloads ───────────────────────────────────

export interface ServerToClientEvents {
  [SocketEvents.ROOM_STATE]: (data: {
    hostId: string;
    isRelaying: boolean;
    members: PresenceInfo[];
  }) => void;

  [SocketEvents.CHAT_NEW_MESSAGE]: (message: ChatMessageWithUser) => void;
  [SocketEvents.CHAT_HISTORY]: (messages: ChatMessageWithUser[]) => void;
  [SocketEvents.CHAT_TYPING]: (data: { userId: string; username: string }) => void;
  [SocketEvents.CHAT_STOP_TYPING]: (data: { userId: string }) => void;

  [SocketEvents.PRESENCE_UPDATE]: (data: PresenceInfo) => void;
  [SocketEvents.PRESENCE_LIST]: (data: PresenceInfo[]) => void;

  [SocketEvents.RELAY_STARTED]: (data: { hostId: string }) => void;
  [SocketEvents.RELAY_STOPPED]: () => void;

  [SocketEvents.QUEUE_UPDATE]: (queue: QueueSuggestion[]) => void;
  [SocketEvents.QUEUE_LIST]: (queue: QueueSuggestion[]) => void;

  [SocketEvents.REACTION]: (data: {
    userId: string;
    username: string;
    emoji: string;
  }) => void;

  [SocketEvents.ERROR]: (data: { message: string }) => void;
}

export interface ClientToServerEvents {
  [SocketEvents.ROOM_JOIN]: (
    data: { roomId: string },
    callback: (response: { success: boolean; error?: string }) => void,
  ) => void;

  [SocketEvents.ROOM_LEAVE]: (data: { roomId: string }) => void;

  [SocketEvents.CHAT_MESSAGE]: (data: {
    roomId: string;
    content: string;
  }) => void;

  [SocketEvents.CHAT_TYPING]: (data: { roomId: string }) => void;
  [SocketEvents.CHAT_STOP_TYPING]: (data: { roomId: string }) => void;

  [SocketEvents.RELAY_STARTED]: (data: { roomId: string }) => void;
  [SocketEvents.RELAY_STOPPED]: (data: { roomId: string }) => void;

  [SocketEvents.QUEUE_SUGGEST]: (data: {
    roomId: string;
    title: string;
    sourceUrl?: string;
  }) => void;

  [SocketEvents.REACTION]: (data: {
    roomId: string;
    emoji: string;
  }) => void;
}
