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

interface RoomState {
  roomId: string | null;
  members: Member[];
  messages: Message[];
  isRelaying: boolean;
  joinRoom: (roomId: string) => void;
  leaveRoom: () => void;
  addMessage: (msg: Message) => void;
  setMessages: (messages: Message[]) => void;
  setMembers: (members: Member[]) => void;
  setRelaying: (status: boolean) => void;
}

export const useRoomStore = create<RoomState>((set) => ({
  roomId: null,
  members: [],
  messages: [],
  isRelaying: false,
  joinRoom: (roomId) => set({ roomId }),
  leaveRoom: () => set({ roomId: null, messages: [], members: [], isRelaying: false }),
  addMessage: (msg) => set((state) => {
    // Avoid duplicate messages
    if (state.messages.some(m => m.id === msg.id)) return state;
    return { messages: [...state.messages, msg] };
  }),
  setMessages: (messages) => set({ messages }),
  setMembers: (members) => set({ members }),
  setRelaying: (status) => set({ isRelaying: status }),
}));
