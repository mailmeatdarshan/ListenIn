import { create } from "zustand";

export interface Message {
  id: string;
  userId: string;
  username: string;
  text: string;
  timestamp: number;
}

export interface Member {
  id: string;
  username: string;
  role: "HOST" | "MODERATOR" | "LISTENER";
  isOnline: boolean;
}

export interface NowPlaying {
  id: string;
  title: string;
  artist: string;
  coverUrl: string;
  audioUrl: string;
  duration: number;      // seconds
  startedAt: number;     // timestamp ms when playback started on server
  isPlaying: boolean;
  seekPosition: number;  // seconds — used when paused or on initial join
}

interface RoomState {
  roomId: string | null;
  members: Member[];
  messages: Message[];
  isRelaying: boolean;
  nowPlaying: NowPlaying | null;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  addMessage: (msg: Message) => void;
  setMessages: (messages: Message[]) => void;
  setMembers: (members: Member[]) => void;
  setRelaying: (status: boolean) => void;
  setNowPlaying: (np: NowPlaying) => void;
  clearNowPlaying: () => void;
  updatePlaybackState: (isPlaying: boolean, seekPosition?: number) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  members: [],
  messages: [],
  isRelaying: false,
  nowPlaying: null,
  joinRoom: (roomId) => set({ roomId }),
  leaveRoom: () => set({ roomId: null, messages: [], members: [], isRelaying: false, nowPlaying: null }),
  addMessage: (msg) => set((state) => {
    // Avoid duplicate messages
    if (state.messages.some(m => m.id === msg.id)) return state;
    return { messages: [...state.messages, msg] };
  }),
  setMessages: (messages) => set({ messages }),
  setMembers: (members) => set({ members }),
  setRelaying: (status) => set({ isRelaying: status }),
  setNowPlaying: (np) => set({ nowPlaying: np }),
  clearNowPlaying: () => set({ nowPlaying: null }),
  updatePlaybackState: (isPlaying, seekPosition) => set((state) => {
    if (!state.nowPlaying) return state;
    return {
      nowPlaying: {
        ...state.nowPlaying,
        isPlaying,
        ...(seekPosition !== undefined ? { seekPosition } : {}),
      },
    };
  }),
}));
