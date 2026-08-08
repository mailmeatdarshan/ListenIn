// ─── Enums ────────────────────────────────────────────

export enum RoomVisibility {
  PRIVATE = 'PRIVATE',
  PUBLIC = 'PUBLIC',
}

export enum RoomRole {
  HOST = 'HOST',
  MODERATOR = 'MODERATOR',
  LISTENER = 'LISTENER',
}

export enum MessageType {
  TEXT = 'TEXT',
  VOICE_NOTE = 'VOICE_NOTE',
}

export enum SuggestionStatus {
  PENDING = 'PENDING',
  PLAYED = 'PLAYED',
  SKIPPED = 'SKIPPED',
}

// ─── Interfaces ───────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  visibility: RoomVisibility;
  inviteCode: string;
  createdAt: string;
}

export interface RoomMember {
  id: string;
  roomId: string;
  userId: string;
  role: RoomRole;
  joinedAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  type: MessageType;
  content: string | null;
  audioUrl: string | null;
  createdAt: string;
}

export interface QueueSuggestion {
  id: string;
  roomId: string;
  suggestedBy: string;
  title: string;
  sourceUrl: string | null;
  status: SuggestionStatus;
  createdAt: string;
}

// ─── Populated types (with relations) ─────────────────

export interface RoomWithHost extends Room {
  host: User;
}

export interface RoomMemberWithUser extends RoomMember {
  user: User;
}

export interface ChatMessageWithUser extends ChatMessage {
  user: User;
}

export interface QueueSuggestionWithUser extends QueueSuggestion {
  suggestedByUser: User;
}

// ─── Presence (Redis, ephemeral) ──────────────────────

export interface PresenceInfo {
  userId: string;
  socketId: string;
  online: boolean;
  micOn: boolean;
  joinedAt: string;
}

export interface RoomState {
  hostId: string;
  isRelaying: boolean;
  livekitRoomName: string;
}
