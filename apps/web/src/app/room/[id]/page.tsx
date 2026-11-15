"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRoomStore } from "@/lib/stores/room-store";
import { fetchApi } from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import { audioManager } from "@/lib/audio-manager";
import { FloatingReactions, ActiveReaction } from "@/components/room/FloatingReactions";
import { RoomThemeModal, RoomThemeConfig, VinylStyle, BackgroundTheme } from "@/components/room/RoomThemeModal";
import { SongSearchModal } from "@/components/room/SongSearchModal";
import { QueuePanel, QueueItem } from "@/components/room/QueuePanel";
import { MonochromePlayer } from "@/components/room/MonochromePlayer";
import { 
  Send, Users, MessageSquare, ListMusic, ArrowLeft, Radio, Copy, Check, 
  Loader2, Trash2, Volume2, Disc, Play, Music, AlertTriangle, X, 
  UserMinus, Crown, Palette, Search, Share2, FolderOpen 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Logo, LogoIcon } from "@/components/Logo";
import { toast } from "sonner";

const BG_GLOWS: Record<BackgroundTheme, string> = {
  RED_WHITE: "from-[#ff2d46]/15 via-transparent to-[#ff2d46]/5",
  MIDNIGHT_BLUE: "from-[#3b82f6]/20 via-transparent to-[#1d4ed8]/10",
  CYBERPUNK_VIOLET: "from-[#a855f7]/20 via-transparent to-[#ec4899]/10",
  EMERALD_GREEN: "from-[#10b981]/20 via-transparent to-[#059669]/10",
};

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;
  
  const { user, hasHydrated } = useAuthStore();
  const { 
    members, messages, nowPlaying, addMessage, setMessages, setMembers, 
    setNowPlaying, clearNowPlaying, updatePlaybackState, joinRoom, leaveRoom 
  } = useRoomStore();
  
  const [roomData, setRoomData] = useState<any>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  const [roomTheme, setRoomTheme] = useState<RoomThemeConfig>({
    vinylStyle: "CLASSIC",
    bgTheme: "RED_WHITE",
  });

  const [activeTab, setActiveTab] = useState<"chat" | "queue">("chat");
  const [mobileTab, setMobileTab] = useState<"room" | "chat">("room");
  const [chatInput, setChatInput] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [roomQueue, setRoomQueue] = useState<QueueItem[]>([]);
  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load room details, chat history, and auto-join via invite code in URL
  useEffect(() => {
    if (!hasHydrated) return;
    if (!user) {
      const currentPath = typeof window !== "undefined" ? window.location.pathname + window.location.search : `/room/${roomId}`;
      router.push(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    async function loadData() {
      if (!roomId) return;
      try {
        setIsLoadingRoom(true);

        // Auto-join if user arrived via invite link with ?code= or ?invite=
        if (typeof window !== "undefined") {
          const searchParams = new URLSearchParams(window.location.search);
          const inviteParam = searchParams.get("code") || searchParams.get("invite");
          if (inviteParam) {
            try {
              await fetchApi("/rooms/join", {
                method: "POST",
                body: JSON.stringify({ inviteCode: inviteParam }),
              });
            } catch (e) {
              // Ignore if already joined
            }
          }
        }

        const data = await fetchApi(`/rooms/${roomId}`);
        setRoomData(data);
        
        const recentMessages = await fetchApi(`/chat/${roomId}`);
        if (Array.isArray(recentMessages)) {
          setMessages(
            recentMessages.map((msg: any) => ({
              id: msg.id,
              userId: msg.userId,
              username: msg.user?.username || "User",
              text: msg.content || "",
              timestamp: new Date(msg.createdAt).getTime(),
            }))
          );
        }
      } catch (err: any) {
        toast.error(err.message || "Failed to load room details");
        router.push("/dashboard");
      } finally {
        setIsLoadingRoom(false);
      }
    }

    loadData();
    joinRoom(roomId);

    return () => {
      audioManager.cleanup();
      leaveRoom();
    };
  }, [roomId, joinRoom, leaveRoom, setMessages, router]);

  const isHost = roomData ? roomData.hostId === user?.id : false;

  // Connect Socket.IO & handle real-time Music, Chat, Reactions & Queue events
  useEffect(() => {
    if (!roomId || !user) return;

    connectSocket();
    const socket = getSocket();

    const handlePresence = (presenceList: any[]) => {
      if (Array.isArray(presenceList)) {
        const updatedMembers = presenceList
          .filter((p) => p.online)
          .map((p) => ({
            id: p.userId,
            username: p.username || "User",
            role: roomData?.hostId === p.userId ? "HOST" : "LISTENER",
            isOnline: p.online,
          }));
        setMembers(updatedMembers as any);
      }
    };

    const handleNewMessage = (msg: any) => {
      addMessage({
        id: msg.id || Date.now().toString(),
        userId: msg.userId || msg.user?.id,
        username: msg.user?.username || msg.username || "User",
        text: msg.content || msg.text || "",
        timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : Date.now(),
      });
    };

    const handleReactionReceived = (data: { id: string; userId: string; username: string; emoji: string }) => {
      const newReaction: ActiveReaction = {
        id: data.id || `${Date.now()}-${Math.random()}`,
        emoji: data.emoji,
        username: data.username || "User",
        xOffset: Math.floor(Math.random() * 60) + 20,
      };

      setActiveReactions((prev) => [...prev, newReaction]);

      setTimeout(() => {
        setActiveReactions((prev) => prev.filter((r) => r.id !== newReaction.id));
      }, 3600);
    };

    const handleThemeUpdated = (newTheme: RoomThemeConfig) => {
      if (newTheme) {
        setRoomTheme(newTheme);
      }
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      toast.info(data.reason || "Room has been closed.");
      audioManager.cleanup();
      router.push("/dashboard");
    };

    const handleQueueUpdated = (items: QueueItem[]) => {
      setRoomQueue(items || []);
    };

    const handleQueueItemAdded = (item: QueueItem) => {
      toast.info(`🎵 "${item.title}" added to queue by ${item.suggestedByUser?.username || "a member"}`);
    };

    // ── Synchronized Music Events ──
    const handleMusicPlaying = (data: any) => {
      if (!data) return;
      setNowPlaying({
        id: `${data.title}-${Date.now()}`,
        title: data.title,
        artist: data.artist || "Unknown Artist",
        coverUrl: data.coverUrl || "",
        audioUrl: data.audioUrl || "",
        duration: data.duration || 180,
        startedAt: data.startedAt || Date.now(),
        isPlaying: data.isPlaying !== false,
        seekPosition: data.seekPosition || 0,
      });
    };

    const handleMusicPaused = (data: { currentTime: number }) => {
      updatePlaybackState(false, data?.currentTime || 0);
    };

    const handleMusicResumed = (data: { currentTime: number; startedAt: number }) => {
      if (!data) return;
      const store = useRoomStore.getState();
      if (store.nowPlaying) {
        setNowPlaying({
          ...store.nowPlaying,
          isPlaying: true,
          startedAt: data.startedAt || Date.now(),
          seekPosition: data.currentTime || 0,
        });
      }
    };

    const handleMusicSeeked = (data: { seekTo: number }) => {
      if (!data) return;
      const store = useRoomStore.getState();
      if (store.nowPlaying) {
        setNowPlaying({
          ...store.nowPlaying,
          seekPosition: data.seekTo || 0,
          startedAt: Date.now() - ((data.seekTo || 0) * 1000),
        });
      }
    };

    const handleMusicError = (data: { message: string }) => {
      toast.error(data?.message || "Failed to play track");
    };

    const handleConnect = () => {
      socket.emit("room:join", { roomId });
    };

    socket.on("room:presence", handlePresence);
    socket.on("chat:message", handleNewMessage);
    socket.on("room:reaction", handleReactionReceived);
    socket.on("reaction", handleReactionReceived);
    socket.on("room:theme_updated", handleThemeUpdated);
    socket.on("room:closed", handleRoomClosed);
    socket.on("queue:updated", handleQueueUpdated);
    socket.on("queue:item_added", handleQueueItemAdded);
    socket.on("music:playing", handleMusicPlaying);
    socket.on("music:paused", handleMusicPaused);
    socket.on("music:resumed", handleMusicResumed);
    socket.on("music:seeked", handleMusicSeeked);
    socket.on("music:error", handleMusicError);
    socket.on("connect", handleConnect);

    socket.emit("room:join", { roomId });
    socket.emit("queue:get", { roomId });

    return () => {
      socket.emit("room:leave", { roomId });
      socket.off("room:presence", handlePresence);
      socket.off("chat:message", handleNewMessage);
      socket.off("room:reaction", handleReactionReceived);
      socket.off("reaction", handleReactionReceived);
      socket.off("room:theme_updated", handleThemeUpdated);
      socket.off("room:closed", handleRoomClosed);
      socket.off("queue:updated", handleQueueUpdated);
      socket.off("queue:item_added", handleQueueItemAdded);
      socket.off("music:playing", handleMusicPlaying);
      socket.off("music:paused", handleMusicPaused);
      socket.off("music:resumed", handleMusicResumed);
      socket.off("music:seeked", handleMusicSeeked);
      socket.off("music:error", handleMusicError);
      socket.off("connect", handleConnect);
    };
  }, [roomId, user, roomData?.hostId, isHost, setMembers, addMessage, setNowPlaying, updatePlaybackState, router]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;

    const textToSend = chatInput.trim();
    setChatInput("");

    const socket = getSocket();
    if (socket) {
      socket.emit("chat:send", {
        roomId,
        content: textToSend,
      });
    }
  };

  const handleSendReaction = (emoji: string) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("room:reaction", { roomId, emoji });
    }
  };

  // 1-Tap Shareable Room Link with Mobile Web Share API support
  const handleShareRoom = async () => {
    if (!roomData) return;
    const shareUrl = `${window.location.origin}/room/${roomId}?code=${roomData.inviteCode}`;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Join "${roomData.name}" on ListenIn`,
          text: `Come listen to music together with me on ListenIn! 🎵`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        // Fallback to clipboard if share cancelled
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedInvite(true);
      toast.success("🔗 Room invite link copied to clipboard!");
      setTimeout(() => setCopiedInvite(false), 2500);
    }
  };

  // Play song from Device (Phone / PC Storage)
  const handleDeviceFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name.replace(/\.[^/.]+$/, "");
    const localUrl = URL.createObjectURL(file);

    // Play locally on host device
    const track = {
      id: `local-${Date.now()}`,
      title: fileName,
      artist: user?.username ? `${user.username} (Device Audio)` : "Local Device Audio",
      coverUrl: "",
      audioUrl: localUrl,
      duration: 180,
      startedAt: Date.now(),
      isPlaying: true,
      seekPosition: 0,
    };
    setNowPlaying(track);

    // Broadcast track info to members
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("chat:send", {
        roomId,
        content: `📁 Playing device audio: "${fileName}"`,
      });
    }
    toast.success(`Playing from device: ${fileName}`);
  };

  const handleSelectTheme = (newTheme: RoomThemeConfig) => {
    setRoomTheme(newTheme);
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("room:theme_change", { roomId, theme: newTheme });
    }
    toast.success("Room theme updated!");
  };

  const handleKickMember = async (targetUserId: string, targetUsername: string) => {
    if (!confirm(`Are you sure you want to kick ${targetUsername} from the room?`)) return;
    try {
      await fetchApi(`/rooms/${roomId}/kick`, {
        method: "POST",
        body: JSON.stringify({ targetUserId }),
      });
      toast.success(`Kicked ${targetUsername} from room`);
    } catch (err: any) {
      toast.error(err.message || "Failed to kick member");
    }
  };

  const handleMakeHost = async (newHostId: string, newHostUsername: string) => {
    if (!confirm(`Are you sure you want to transfer Host ownership to ${newHostUsername}?`)) return;
    try {
      await fetchApi(`/rooms/${roomId}/transfer-host`, {
        method: "POST",
        body: JSON.stringify({ newHostId }),
      });
      toast.success(`${newHostUsername} is now the Host!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to transfer host role");
    }
  };

  const handleAddTrackToQueue = (track: { title: string; artist: string; coverUrl: string; sourceUrl: string; audioUrl?: string; duration?: number }) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("queue:add", {
        roomId,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        sourceUrl: track.sourceUrl,
        audioUrl: track.audioUrl,
        duration: track.duration,
      });
    }
  };

  const handleRemoveQueueItem = (suggestionId: string) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("queue:remove", { roomId, suggestionId });
    }
  };

  const handlePlayNextQueueTrack = () => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("queue:next", { roomId });
    }
  };

  const handlePlayTrackNow = (track: QueueItem) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("music:play", {
        roomId,
        title: track.title,
        artist: track.artist || "",
        coverUrl: track.coverUrl || "",
        audioUrl: track.audioUrl || "",
        duration: track.duration || 180,
      });
    }
  };

  const confirmDeleteRoom = async () => {
    try {
      setIsDeleting(true);
      await fetchApi(`/rooms/${roomId}`, { method: "DELETE" });
      toast.success("Room deleted successfully");
      setShowDeleteModal(false);
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete room");
      setIsDeleting(false);
    }
  };

  if (isLoadingRoom) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0c0c0e]">
        <div className="text-center flex flex-col items-center">
          <Loader2 size={36} className="animate-spin text-[#ff2d46] mb-4" />
          <p className="text-zinc-400">Connecting to room...</p>
        </div>
      </div>
    );
  }

  const hostMember = members.find((m) => m.role === "HOST") || { username: roomData?.host?.username || "Host" };

  return (
    <div className="h-screen max-h-screen w-screen overflow-hidden flex flex-col bg-[#0c0c0e] text-[#f4f4f5] font-sans relative">
      {/* Hidden file input for device music picker */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={handleDeviceFileSelect}
      />

      {/* Music Search & Queue Modal */}
      <SongSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        roomId={roomId}
        isHost={isHost}
        onAddTrackToQueue={handleAddTrackToQueue}
      />

      {/* Floating Live Beat-Drop Emojis Component */}
      <FloatingReactions reactions={activeReactions} showBar={false} />

      {/* Host Room Theme Selection Modal */}
      <RoomThemeModal
        isOpen={isThemeModalOpen}
        onClose={() => setIsThemeModalOpen(false)}
        currentTheme={roomTheme}
        onSelectTheme={handleSelectTheme}
      />

      {/* Delete Room Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#141417] border border-[#27272a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
            >
              <button
                onClick={() => setShowDeleteModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-[#1e1e24] border border-[#2d2d35] transition-colors"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 rounded-full bg-[#ff2d46]/10 border border-[#ff2d46]/30 text-[#ff2d46] flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={30} />
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                Delete Listening Room?
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
                Are you sure you want to delete <strong className="text-white">"{roomData?.name}"</strong>? All active listeners will be disconnected and this action cannot be undone.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteRoom}
                  disabled={isDeleting}
                  className="flex-1 bg-[#ff2d46] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-lg shadow-red-950/50 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Delete Room
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mobile Top Navigation Tabs */}
      <div className="md:hidden flex border-b border-[#27272a] bg-[#141417]/90 backdrop-blur-md flex-shrink-0 z-40">
        <button
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 ${
            mobileTab === "room" ? "text-[#ff2d46] border-b-2 border-[#ff2d46]" : "text-zinc-400"
          }`}
          onClick={() => setMobileTab("room")}
        >
          <Music size={14} /> Player & Members
        </button>
        <button
          className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 ${
            mobileTab === "chat" ? "text-[#ff2d46] border-b-2 border-[#ff2d46]" : "text-zinc-400"
          }`}
          onClick={() => setMobileTab("chat")}
        >
          <MessageSquare size={14} /> Chat & Queue ({messages.length})
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden min-h-0">
        {/* Left/Main Content: Monochrome Music Player & Members */}
        <div className={`flex-1 flex flex-col p-4 md:p-8 overflow-y-auto min-h-0 ${mobileTab === "chat" ? "hidden md:flex" : "flex"}`}>
          <header className="flex flex-wrap sm:flex-nowrap justify-between items-center mb-6 flex-shrink-0 gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/dashboard" className="flex items-center gap-1.5 text-zinc-400 hover:text-white transition-colors text-xs md:text-sm mr-1">
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
              <Logo size="sm" />
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <h1 className="text-sm md:text-xl font-bold truncate max-w-[90px] xs:max-w-[130px] sm:max-w-xs">{roomData?.name}</h1>
              
              {/* 1-Tap Share Room Link Button */}
              <button
                onClick={handleShareRoom}
                className="bg-[#ff2d46]/10 hover:bg-[#ff2d46]/20 border border-[#ff2d46]/30 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm active:scale-95 shrink-0"
                title="Share room link with friends"
              >
                {copiedInvite ? (
                  <>
                    <Check size={14} className="text-emerald-400" />
                    <span className="text-emerald-400">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 size={14} className="text-[#ff2d46]" />
                    <span>Share Room</span>
                    <span className="bg-[#ff2d46]/20 text-[#ff2d46] px-1.5 py-0.2 rounded text-[10px] font-mono ml-0.5">
                      {roomData?.inviteCode}
                    </span>
                  </>
                )}
              </button>

              {isHost && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setIsThemeModalOpen(true)}
                    className="bg-[#1e1e24] hover:bg-[#2d2d35] border border-[#3f3f46] text-white px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Customize Room Theme & Vinyl"
                  >
                    <Palette size={14} className="text-[#ff2d46]" />
                    <span className="hidden sm:inline">Theme</span>
                  </button>

                  <button
                    onClick={() => setShowDeleteModal(true)}
                    className="bg-[#ff2d46]/20 text-[#ff2d46] hover:bg-[#ff2d46]/30 border border-[#ff2d46]/40 px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Delete Room"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Delete</span>
                  </button>
                </div>
              )}
            </div>
          </header>

          {/* Central Built-in Music Player Area with Ambient Theme Glow */}
          <div className="relative mb-6 flex-shrink-0">
            {/* Ambient Background Glow */}
            <div className={`absolute -inset-10 bg-gradient-to-r ${BG_GLOWS[roomTheme.bgTheme]} blur-3xl pointer-events-none transition-all duration-700`}></div>

            <MonochromePlayer
              nowPlaying={nowPlaying}
              isHost={isHost}
              roomId={roomId}
              onSearchClick={() => setIsSearchModalOpen(true)}
              onPlayNext={handlePlayNextQueueTrack}
              hasQueueItems={roomQueue.length > 0}
            />

            {/* Action Buttons under Player */}
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setIsSearchModalOpen(true)}
                className="bg-[#141417] border border-[#27272a] hover:border-[#ff2d46]/50 text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-[#ff2d46]/10 active:scale-95"
              >
                <Search size={15} className="text-[#ff2d46]" />
                Search Songs
              </button>

              {isHost && (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#141417] border border-[#27272a] hover:border-zinc-500 text-zinc-300 hover:text-white px-5 py-2.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all active:scale-95"
                  title="Play an audio file from your phone or computer"
                >
                  <FolderOpen size={15} className="text-zinc-400" />
                  Pick from Device
                </button>
              )}

              {nowPlaying && (
                <span className="text-[11px] text-zinc-500 font-medium ml-auto hidden sm:inline">
                  Synchronized Live Audio • 320kbps
                </span>
              )}
            </div>
          </div>

          {/* Members List with Quick Emoji Reaction Bar */}
          <div className="flex-1 flex flex-col min-h-[200px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} /> Room Members ({members.length})
              </h3>

              {/* Quick Emoji Reaction Bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider hidden sm:inline">React:</span>
                <FloatingReactions reactions={activeReactions} onSendReaction={handleSendReaction} />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
              {members.map((member) => (
                <div 
                  key={member.id} 
                  className="bg-[#141417] border border-[#27272a] rounded-xl p-3 flex items-center justify-between gap-3 relative overflow-hidden group hover:border-[#3f3f46] transition-colors"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-[#1f1f23] border border-[#27272a] flex items-center justify-center text-xs font-bold text-white uppercase shrink-0">
                      {member.username.substring(0, 2)}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold truncate text-white">{member.username}</p>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full uppercase tracking-wider ${
                        member.role === "HOST" ? "bg-[#ff2d46]/20 text-[#ff2d46]" : "bg-zinc-800 text-zinc-400"
                      }`}>
                        {member.role}
                      </span>
                    </div>
                  </div>

                  {/* Host Action Buttons for Other Members */}
                  {isHost && member.id !== user?.id && (
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleMakeHost(member.id, member.username)}
                        className="p-1.5 rounded-lg bg-[#1e1e24] hover:bg-[#ff2d46]/20 text-zinc-400 hover:text-[#ff2d46] transition-colors"
                        title={`Make ${member.username} the Host`}
                      >
                        <Crown size={14} />
                      </button>
                      <button
                        onClick={() => handleKickMember(member.id, member.username)}
                        className="p-1.5 rounded-lg bg-[#1e1e24] hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                        title={`Kick ${member.username}`}
                      >
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right/Secondary Column: Live Synchronized Chat & Room Queue */}
        <div className={`w-full md:w-96 border-l border-[#27272a] bg-[#101014] flex flex-col h-full min-h-0 ${mobileTab === "room" ? "hidden md:flex" : "flex"}`}>
          {/* Tabs Switcher: Chat vs Queue */}
          <div className="flex border-b border-[#27272a] bg-[#141417] px-4 pt-3 flex-shrink-0">
            <button
              onClick={() => setActiveTab("chat")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${
                activeTab === "chat" 
                  ? "border-[#ff2d46] text-white" 
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <MessageSquare size={16} />
              <span>Live Chat</span>
              <span className="text-[10px] bg-[#1f1f23] px-1.5 py-0.5 rounded-full text-zinc-400">
                {messages.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("queue")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs md:text-sm font-bold border-b-2 transition-colors ${
                activeTab === "queue" 
                  ? "border-[#ff2d46] text-white" 
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              }`}
            >
              <ListMusic size={16} />
              <span>Queue</span>
              <span className="text-[10px] bg-[#1f1f23] px-1.5 py-0.5 rounded-full text-zinc-400">
                {roomQueue.length}
              </span>
            </button>
          </div>

          {/* Tab 1: Live Chat Content */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col min-h-0">
              <div 
                ref={messagesContainerRef}
                className="flex-1 p-4 overflow-y-auto space-y-4 min-h-0"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center text-zinc-500 py-12">
                    <MessageSquare size={36} className="mb-2 opacity-30" />
                    <p className="text-sm font-medium">No messages yet</p>
                    <p className="text-xs text-zinc-600 mt-1">Start the conversation with your friends!</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isSelf = msg.userId === user?.id;
                    return (
                      <div key={msg.id} className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[11px] font-semibold text-zinc-400">{msg.username}</span>
                          <span className="text-[9px] text-zinc-600">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div 
                          className={`px-3.5 py-2 rounded-2xl max-w-[85%] text-xs sm:text-sm leading-relaxed break-words shadow-sm ${
                            isSelf 
                              ? "bg-[#ff2d46] text-white rounded-tr-none" 
                              : "bg-[#1f1f23] text-zinc-200 rounded-tl-none border border-[#27272a]"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Box */}
              <form onSubmit={handleSendMessage} className="p-3 bg-[#141417] border-t border-[#27272a] flex items-center gap-2 flex-shrink-0">
                <input
                  ref={chatInputRef}
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Send a message..."
                  maxLength={500}
                  className="flex-1 bg-[#1c1c20] border border-[#27272a] rounded-full px-4 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff2d46] transition-colors"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="w-9 h-9 rounded-full bg-[#ff2d46] hover:bg-[#e11d48] text-white flex items-center justify-center disabled:opacity-40 transition-colors shrink-0 shadow-md shadow-red-950/40"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          )}

          {/* Tab 2: Synchronized Room Queue */}
          {activeTab === "queue" && (
            <div className="flex-1 flex flex-col min-h-0">
              <QueuePanel
                queue={roomQueue}
                isHost={isHost}
                onRemoveQueueItem={handleRemoveQueueItem}
                onPlayTrackNow={handlePlayTrackNow}
                onPlayNextQueueTrack={handlePlayNextQueueTrack}
                onOpenSpotifyModal={() => setIsSearchModalOpen(true)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
