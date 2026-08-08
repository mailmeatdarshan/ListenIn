"use client";

export const dynamic = "force-dynamic";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useRoomStore } from "@/lib/stores/room-store";
import { fetchApi } from "@/lib/api";
import { connectSocket, getSocket } from "@/lib/socket";
import { connectLivekitRoom, disconnectLivekitRoom } from "@/lib/livekit";
import { 
  createHostOfferForListener, 
  handleHostAnswer, 
  handleListenerOffer, 
  handleIceCandidate,
  stopListenerAudioStream,
  unlockAudioPlayback,
  getAudioPlayerElement
} from "@/lib/webrtc-audio";
import { ShareAudioButton } from "@/components/room/ShareAudioButton";
import { FloatingReactions, ActiveReaction } from "@/components/room/FloatingReactions";
import { RoomThemeModal, RoomThemeConfig, VinylStyle, BackgroundTheme } from "@/components/room/RoomThemeModal";
import { SpotifyModal } from "@/components/room/SpotifyModal";
import { QueuePanel, QueueItem } from "@/components/room/QueuePanel";
import { Send, Users, MessageSquare, ListMusic, ArrowLeft, Radio, Copy, Check, Loader2, Trash2, Volume2, Disc, Play, Music, Cast, AlertTriangle, X, UserMinus, Crown, ShieldAlert, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Logo, LogoIcon } from "@/components/Logo";
import { toast } from "sonner";

const VINYL_GRADIENTS: Record<VinylStyle, string> = {
  CLASSIC: "from-[#1f1f23] via-[#09090b] to-[#27272a]",
  RED_NEON: "from-[#ff2d46] via-[#7f1d1d] to-[#000000]",
  RETRO_GOLD: "from-[#f59e0b] via-[#78350f] to-[#18181b]",
  CYBERPUNK: "from-[#06b6d4] via-[#4c1d95] to-[#0f172a]",
};

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
  
  const { user } = useAuthStore();
  const { members, messages, isRelaying, addMessage, setMessages, setMembers, setRelaying, joinRoom, leaveRoom } = useRoomStore();
  
  const [roomData, setRoomData] = useState<any>(null);
  const [isLoadingRoom, setIsLoadingRoom] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

  // Dynamic Track Title & Artist State (auto-detected via MediaSession API)
  const [trackInfo, setTrackInfo] = useState({
    title: "Live Audio Stream",
    artist: "Host Broadcast",
  });
  const lastEmittedTrackRef = useRef({ title: "", artist: "" });

  const [sharedTabStream, setSharedTabStream] = useState<MediaStream | null>(null);
  const [tabThumbnail, setTabThumbnail] = useState<string | null>(null);
  const hostVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [roomTheme, setRoomTheme] = useState<RoomThemeConfig>({
    vinylStyle: "CLASSIC",
    bgTheme: "RED_WHITE",
  });

  const [activeTab, setActiveTab] = useState<"chat" | "queue">("chat");
  const [mobileTab, setMobileTab] = useState<"room" | "chat">("room");
  const [chatInput, setChatInput] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false);
  const [roomQueue, setRoomQueue] = useState<QueueItem[]>([]);
  const syncedAudioRef = useRef<HTMLAudioElement>(null);

  const [activeReactions, setActiveReactions] = useState<ActiveReaction[]>([]);

  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const latestPresenceRef = useRef<any[]>([]);

  // Initialize hidden audio player element
  useEffect(() => {
    if (typeof window !== "undefined") {
      getAudioPlayerElement();
    }
  }, []);

  // Load room details & chat history
  useEffect(() => {
    async function loadData() {
      try {
        setIsLoadingRoom(true);
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

    if (roomId) {
      loadData();
      joinRoom(roomId);
    }

    return () => {
      stopListenerAudioStream();
      leaveRoom();
    };
  }, [roomId, joinRoom, leaveRoom, setMessages, router]);

  // Connect LiveKit SFU for WebRTC audio fallback
  useEffect(() => {
    let isSubscribed = true;

    async function initLivekit() {
      if (!roomId || !user) return;
      try {
        const { token } = await fetchApi(`/rooms/${roomId}/livekit-token`);
        const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://your-project.livekit.cloud";
        
        if (isSubscribed && token && livekitUrl) {
          await connectLivekitRoom(
            token,
            livekitUrl,
            (track) => {
              setRelaying(true);
            },
            (track) => {}
          );
        }
      } catch (err) {
        console.warn("LiveKit token fallback to WebRTC P2P:", err);
      }
    }

    initLivekit();

    return () => {
      isSubscribed = false;
      disconnectLivekitRoom();
    };
  }, [roomId, user, setRelaying]);

  const isHost = roomData ? roomData.hostId === user?.id : false;

  // Connect Socket.IO & handle real-time WebRTC + Chat + Reaction + Track + Theme events
  useEffect(() => {
    if (!roomId || !user) return;

    connectSocket();
    const socket = getSocket();

    const handlePresence = (presenceList: any[]) => {
      if (Array.isArray(presenceList)) {
        latestPresenceRef.current = presenceList;
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

    const handleRelayStatus = (data: { isRelaying: boolean; hostSocketId?: string }) => {
      setRelaying(data.isRelaying);
      if (data.isRelaying && !isHost) {
        const socket = getSocket();
        if (socket) {
          socket.emit("webrtc:request-offer", { roomId, listenerSocketId: socket.id });
        }
      }
    };

    const handleWebRtcRequestOffer = (data: { listenerSocketId: string; roomId: string }) => {
      if (isHost && data.listenerSocketId) {
        createHostOfferForListener(data.listenerSocketId, roomId);
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

    const handleTrackUpdated = (data: { title: string; artist: string }) => {
      if (data?.title) {
        setTrackInfo({
          title: data.title,
          artist: data.artist || "Broadcasting Live",
        });
      }
    };

    const handleThemeUpdated = (newTheme: RoomThemeConfig) => {
      if (newTheme) {
        setRoomTheme(newTheme);
      }
    };

    const handleRelayStart = (data: { hostId: string; socketId?: string }) => {
      setRelaying(true);
      toast.success("Host started audio broadcast!");

      if (isHost) {
        latestPresenceRef.current.forEach((p) => {
          if (p.userId !== user.id && p.socketId) {
            createHostOfferForListener(p.socketId, roomId);
          }
        });
      } else {
        const socket = getSocket();
        if (socket) {
          socket.emit("webrtc:request-offer", { roomId, listenerSocketId: socket.id });
        }
      }
    };

    const handleRelayStop = () => {
      setRelaying(false);
      stopListenerAudioStream();
      toast.info("Broadcast stopped");
    };

    const handleRoomClosed = (data: { reason?: string }) => {
      toast.info(data.reason || "Room has been closed.");
      stopListenerAudioStream();
      router.push("/dashboard");
    };

    const handleWebRtcOffer = (data: { senderSocketId: string; sdp: any }) => {
      if (!isHost) {
        handleListenerOffer(data.senderSocketId, data.sdp);
      }
    };

    const handleWebRtcAnswer = (data: { senderSocketId: string; sdp: any }) => {
      if (isHost) {
        handleHostAnswer(data.senderSocketId, data.sdp);
      }
    };

    const handleWebRtcIceCandidate = (data: { senderSocketId: string; candidate: any }) => {
      handleIceCandidate(data.senderSocketId, data.candidate);
    };

    const handleConnect = () => {
      socket.emit("room:join", { roomId });
    };

    const handleTabPreview = (data: { thumbnail: string }) => {
      if (data?.thumbnail) {
        setTabThumbnail(data.thumbnail);
      }
    };

    const handleQueueUpdated = (items: QueueItem[]) => {
      setRoomQueue(items || []);
    };

    const handleQueueItemAdded = (item: QueueItem) => {
      toast.info(`🎵 "${item.title}" added to queue by ${item.suggestedByUser?.username || "a member"}`);
    };

    const handleTrackPlaySynced = (data: { title: string; artist: string; coverUrl?: string; audioUrl?: string }) => {
      setTrackInfo({
        title: data.title,
        artist: data.artist || "Spotify Track",
      });

      if (data.audioUrl && syncedAudioRef.current) {
        syncedAudioRef.current.src = data.audioUrl;
        syncedAudioRef.current.play().catch(() => {
          unlockAudioPlayback();
        });
      }
      toast.success(`▶ Now Playing: ${data.title}`);
    };

    socket.on("room:presence", handlePresence);
    socket.on("relay:status", handleRelayStatus);
    socket.on("webrtc:request-offer", handleWebRtcRequestOffer);
    socket.on("chat:message", handleNewMessage);
    socket.on("room:reaction", handleReactionReceived);
    socket.on("reaction", handleReactionReceived);
    socket.on("room:track_updated", handleTrackUpdated);
    socket.on("room:theme_updated", handleThemeUpdated);
    socket.on("relay:start", handleRelayStart);
    socket.on("relay:stop", handleRelayStop);
    socket.on("room:closed", handleRoomClosed);
    socket.on("webrtc:offer", handleWebRtcOffer);
    socket.on("webrtc:answer", handleWebRtcAnswer);
    socket.on("webrtc:ice-candidate", handleWebRtcIceCandidate);
    socket.on("room:tab_preview", handleTabPreview);
    socket.on("queue:updated", handleQueueUpdated);
    socket.on("queue:item_added", handleQueueItemAdded);
    socket.on("track:play_synced", handleTrackPlaySynced);
    socket.on("connect", handleConnect);

    socket.emit("room:join", { roomId });
    socket.emit("queue:get", { roomId });

    return () => {
      socket.emit("room:leave", { roomId });
      socket.off("room:presence", handlePresence);
      socket.off("relay:status", handleRelayStatus);
      socket.off("webrtc:request-offer", handleWebRtcRequestOffer);
      socket.off("chat:message", handleNewMessage);
      socket.off("room:reaction", handleReactionReceived);
      socket.off("reaction", handleReactionReceived);
      socket.off("room:track_updated", handleTrackUpdated);
      socket.off("room:theme_updated", handleThemeUpdated);
      socket.off("relay:start", handleRelayStart);
      socket.off("relay:stop", handleRelayStop);
      socket.off("room:closed", handleRoomClosed);
      socket.off("webrtc:offer", handleWebRtcOffer);
      socket.off("webrtc:answer", handleWebRtcAnswer);
      socket.off("webrtc:ice-candidate", handleWebRtcIceCandidate);
      socket.off("room:tab_preview", handleTabPreview);
      socket.off("queue:updated", handleQueueUpdated);
      socket.off("queue:item_added", handleQueueItemAdded);
      socket.off("track:play_synced", handleTrackPlaySynced);
      socket.off("connect", handleConnect);
    };
  }, [roomId, user, roomData?.hostId, isHost, setMembers, addMessage, setRelaying, router]);

  // ── Auto-detect Now Playing via MediaSession API (zero-effort for host) ──
  useEffect(() => {
    if (!isHost || !isRelaying || !roomId) return;

    const pollMediaSession = () => {
      try {
        const meta = navigator.mediaSession?.metadata;
        if (!meta) return;

        const newTitle = meta.title?.trim() || "";
        const newArtist = meta.artist?.trim() || "";

        if (!newTitle) return;

        const last = lastEmittedTrackRef.current;
        if (last.title === newTitle && last.artist === newArtist) return;

        // Track changed — update local state and broadcast
        const newTrack = {
          title: newTitle,
          artist: newArtist || "Unknown Artist",
        };
        lastEmittedTrackRef.current = newTrack;
        setTrackInfo(newTrack);

        const socket = getSocket();
        if (socket) {
          socket.emit("room:update_track", { roomId, ...newTrack });
        }
      } catch (e) {
        // MediaSession not supported or access denied — silent fail
      }
    };

    // Poll immediately, then every 3 seconds
    pollMediaSession();
    const intervalId = setInterval(pollMediaSession, 3000);

    return () => clearInterval(intervalId);
  }, [isHost, isRelaying, roomId]);

  // Host: render live video preview + capture thumbnails for listeners
  useEffect(() => {
    if (!isHost || !sharedTabStream || !isRelaying) {
      return;
    }

    // Attach stream to hidden video element for frame capture
    const videoEl = hostVideoRef.current;
    if (videoEl) {
      videoEl.srcObject = sharedTabStream;
      videoEl.play().catch(() => {});
    }

    // Capture + send thumbnail every 8 seconds
    const captureAndSend = () => {
      const video = hostVideoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.videoWidth === 0) return;

      canvas.width = 320;
      canvas.height = Math.round((video.videoHeight / video.videoWidth) * 320) || 180;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);

      const socket = getSocket();
      if (socket && roomId) {
        socket.emit('room:tab_preview', { roomId, thumbnail: dataUrl });
      }
    };

    // Wait a moment for video to load, then start capturing
    const startTimeout = setTimeout(() => {
      captureAndSend();
    }, 2000);

    const intervalId = setInterval(captureAndSend, 8000);

    return () => {
      clearTimeout(startTimeout);
      clearInterval(intervalId);
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
  }, [isHost, sharedTabStream, isRelaying, roomId]);


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

  const handleStreamCapture = (stream: MediaStream | null) => {
    setSharedTabStream(stream);
    if (!stream) {
      setTabThumbnail(null);
    }
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

  const handleCopyInvite = () => {
    if (roomData?.inviteCode) {
      navigator.clipboard.writeText(roomData.inviteCode);
      setCopiedInvite(true);
      toast.success("Invite code copied!");
      setTimeout(() => setCopiedInvite(false), 2000);
    }
  };

  const handleAddSpotifyTrackToQueue = (track: { title: string; artist: string; coverUrl: string; sourceUrl: string }) => {
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit("queue:add", {
        roomId,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        sourceUrl: track.sourceUrl,
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
      {/* Hidden elements for tab preview capture & synced queue audio playback */}
      <video ref={hostVideoRef} className="hidden" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />
      <audio ref={syncedAudioRef} className="hidden" autoPlay playsInline />

      {/* Spotify Music Search & Queue Modal */}
      <SpotifyModal
        isOpen={isSpotifyModalOpen}
        onClose={() => setIsSpotifyModalOpen(false)}
        onAddTrackToQueue={handleAddSpotifyTrackToQueue}
      />

      {/* Floating Live Beat-Drop Emojis Component (Particles only) */}
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
          <Radio size={14} /> Broadcast & Members
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
        {/* Left/Main Content: Now Playing & Members */}
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
              <button
                onClick={handleCopyInvite}
                className="bg-[#141417] border border-[#27272a] px-2.5 py-1 md:px-3 md:py-1.5 rounded-full text-xs font-medium flex items-center gap-1 hover:border-[#ff2d46]/50 transition-colors shrink-0"
                title="Click to copy invite code"
              >
                <span>Code: <strong className="text-[#ff2d46] tracking-wider">{roomData?.inviteCode}</strong></span>
                {copiedInvite ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-zinc-400" />}
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

          {/* Album Art Live Broadcast Player Area with Dynamic Theme Glow & Vinyl Style */}
          <div className="bg-[#141417] rounded-3xl border border-[#27272a] p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden mb-6 min-h-[300px] md:min-h-[340px] flex-shrink-0 shadow-2xl">
            {/* Background Ambient Dynamic Glow Theme */}
            <div className={`absolute -inset-10 bg-gradient-to-r ${BG_GLOWS[roomTheme.bgTheme]} blur-3xl pointer-events-none transition-all duration-700`}></div>

            {isRelaying ? (
              <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8 w-full z-10">
                {/* Vinyl / Cover Art Container */}
                <div className="relative group shrink-0">
                  {/* Live Tab Preview */}
                  {(isHost && sharedTabStream) || (!isHost && tabThumbnail) ? (
                    <div className="relative w-72 h-48 md:w-[26rem] md:h-64 rounded-2xl overflow-hidden border-2 border-[#27272a] shadow-2xl">
                      {isHost && sharedTabStream ? (
                        <video
                          ref={(el) => {
                            if (el && sharedTabStream) {
                              el.srcObject = sharedTabStream;
                              el.play().catch(() => {});
                            }
                          }}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                          autoPlay
                        />
                      ) : tabThumbnail ? (
                        <img
                          src={tabThumbnail}
                          alt="Now Playing"
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      {/* LIVE badge */}
                      <div className="absolute top-2 left-2 bg-[#ff2d46] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20 shadow-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                        <span>LIVE</span>
                      </div>
                      {/* Small vinyl overlay */}
                      <div className="absolute -bottom-4 -right-4 w-16 h-16 md:w-20 md:h-20">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                          className={`w-full h-full rounded-full bg-gradient-to-tr ${VINYL_GRADIENTS[roomTheme.vinylStyle]} border-2 border-[#27272a] shadow-lg flex items-center justify-center`}
                        >
                          <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-[#ff2d46] border-2 border-black flex items-center justify-center">
                            <LogoIcon className="w-3 h-3 md:w-4 md:h-4 text-white" />
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  ) : (
                    /* Fallback: Original Vinyl when no preview available */
                    <div
                      className="relative group cursor-pointer"
                      title="Live Host Audio Stream"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                        className={`w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-tr ${VINYL_GRADIENTS[roomTheme.vinylStyle]} border-4 border-[#27272a] shadow-2xl flex items-center justify-center relative p-2 transition-all duration-500`}
                      >
                        <div className="w-full h-full rounded-full border border-white/10 flex items-center justify-center p-3">
                          <div className="w-full h-full rounded-full border border-white/20 flex items-center justify-center p-3">
                            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#ff2d46] border-4 border-black flex items-center justify-center text-white shadow-inner">
                              <LogoIcon className="w-8 h-8 md:w-10 md:h-10 text-white" />
                            </div>
                          </div>
                        </div>
                      </motion.div>
                      <div className="absolute top-0 right-0 bg-[#ff2d46] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border border-white/20 shadow-lg flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                        <span>LIVE</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Track Details & Host Broadcast Controls */}
                <div className="flex-1 flex flex-col items-center md:items-start text-center md:text-left w-full">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="bg-[#ff2d46]/20 border border-[#ff2d46]/40 text-[#ff2d46] text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
                      Broadcasting Audio
                    </span>
                    <span className="text-zinc-500 text-xs font-mono">• WebRTC Sync</span>
                  </div>

                  {/* Dynamic Track Title — auto-synced via MediaSession */}
                  <h2 className="text-2xl md:text-3xl font-black text-white tracking-tight mb-1">
                    {trackInfo.title !== "Live Audio Stream" ? trackInfo.title : "Now Playing"}
                  </h2>
                  <p className="text-zinc-400 text-sm font-medium mb-4">
                    {trackInfo.artist !== "Host Broadcast" ? `${trackInfo.artist} • ` : ""}Host: <span className="text-white font-bold">{hostMember.username}</span>
                  </p>

                  {/* Host Stop Broadcast Button */}
                  {isHost && (
                    <div className="mb-4">
                      <ShareAudioButton isHost={isHost} roomId={roomId} isRelaying={isRelaying} onRelayStateChange={setRelaying} onStreamCapture={handleStreamCapture} />
                    </div>
                  )}

                  {/* Animated Equalizer Waveform */}
                  <div className="flex items-end justify-center md:justify-start gap-1 h-10 w-full max-w-sm mt-2">
                    {[...Array(28)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-1.5 bg-gradient-to-t from-[#ff2d46] to-[#ff6b7d] rounded-t-full"
                        animate={{ height: [6, Math.random() * 32 + 6, 6] }}
                        transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.04 }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center w-full py-4 text-center z-10">
                <div className="w-20 h-20 rounded-full bg-[#1e1e24] border border-[#2d2d35] flex items-center justify-center mb-4 text-[#ff2d46]">
                  {isHost ? <Cast size={36} className="animate-pulse" /> : <Disc size={36} className="text-zinc-500" />}
                </div>

                <h2 className="text-xl md:text-2xl font-bold text-white mb-1">
                  {isHost ? "Start Your Live Broadcast" : "Host is Currently Offline"}
                </h2>

                <p className="text-xs md:text-sm text-zinc-400 mb-6 max-w-sm leading-relaxed">
                  {isHost 
                    ? "Share your browser tab audio, Spotify, YouTube, or system playback live with everyone in the room." 
                    : `Waiting for host (${hostMember.username}) to start broadcasting audio...`
                  }
                </p>

                {isHost && (
                  <div className="flex justify-center w-full">
                    <ShareAudioButton isHost={isHost} roomId={roomId} isRelaying={isRelaying} onRelayStateChange={setRelaying} onStreamCapture={handleStreamCapture} />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Members List with Prominent Emoji Reaction Bar */}
          <div className="flex-1 flex flex-col min-h-[200px]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Users size={16} /> Room Members ({members.length})
              </h3>

              {/* Perfectly Placed Quick Emoji Reaction Bar above Members */}
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

        {/* Right Sidebar: Chat & Music Queue */}
        <div className={`w-full md:w-80 lg:w-96 border-l border-[#27272a] bg-[#0c0c0e] flex flex-col h-full overflow-hidden flex-shrink-0 z-10 ${mobileTab === "room" ? "hidden md:flex" : "flex"}`}>
          {/* Header Tabs */}
          <div className="flex border-b border-[#27272a] flex-shrink-0">
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "chat" ? "text-[#ff2d46] border-b-2 border-[#ff2d46] bg-[#141417]" : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => setActiveTab("chat")}
            >
              Chat ({messages.length})
            </button>
            <button
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors ${
                activeTab === "queue" ? "text-[#ff2d46] border-b-2 border-[#ff2d46] bg-[#141417]" : "text-zinc-400 hover:text-white"
              }`}
              onClick={() => setActiveTab("queue")}
            >
              Queue
            </button>
          </div>

          {/* Tab 1: Live Room Chat */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col h-full overflow-hidden min-h-0">
              <div 
                ref={messagesContainerRef}
                className="flex-1 overflow-y-auto min-h-0 max-h-full p-4 space-y-3"
              >
                {messages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-center p-6 text-zinc-500 text-xs">
                    No messages yet. Say hello to everyone!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === user?.id;
                    return (
                      <div 
                        key={msg.id}
                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                      >
                        <span className="text-[10px] text-zinc-500 mb-1 px-1">{msg.username}</span>
                        <div 
                          className={`max-w-[85%] rounded-2xl px-4 py-2 text-xs leading-relaxed ${
                            isMe 
                              ? "bg-[#ff2d46] text-white font-medium rounded-br-none shadow-md" 
                              : "bg-[#141417] border border-[#27272a] text-zinc-200 rounded-bl-none"
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input */}
              <div className="p-3 border-t border-[#27272a] bg-[#141417] flex flex-col gap-2 flex-shrink-0">
                <form 
                  onSubmit={handleSendMessage}
                  className="flex items-center gap-2 w-full"
                >
                  <input
                    ref={chatInputRef}
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Send a message..."
                    className="flex-1 bg-[#27272a] border border-[#3f3f46] text-white text-xs rounded-full px-4 py-2.5 focus:outline-none focus:border-[#ff2d46]"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="w-9 h-9 rounded-full bg-[#ff2d46] hover:bg-[#e11d48] text-white flex items-center justify-center transition-colors disabled:opacity-50 shrink-0"
                  >
                    <Send size={14} />
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab 2: Shared Music Queue */}
          {activeTab === "queue" && (
            <div className="flex-1 h-full overflow-hidden">
              <QueuePanel
                queue={roomQueue}
                isHost={isHost}
                onOpenSpotifyModal={() => setIsSpotifyModalOpen(true)}
                onRemoveQueueItem={handleRemoveQueueItem}
                onPlayNextQueueTrack={handlePlayNextQueueTrack}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
