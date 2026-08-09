"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/stores/auth-store";
import { fetchApi } from "@/lib/api";
import { LogOut, Plus, Search, Headphones, Loader2, Sparkles, X, KeyRound, Globe, Lock, ShieldCheck } from "lucide-react";
import { RoomCard } from "@/components/RoomCard";
import { Logo } from "@/components/Logo";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface RoomData {
  id: string;
  name: string;
  hostId: string;
  inviteCode: string;
  visibility?: "PUBLIC" | "PRIVATE";
  createdAt: string;
  host?: {
    id: string;
    username: string;
  };
  members?: Array<{ userId: string }>;
  _count?: {
    members: number;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, hasHydrated, logout } = useAuthStore();
  
  const [rooms, setRooms] = useState<RoomData[]>([]);
  const [publicRooms, setPublicRooms] = useState<RoomData[]>([]);
  const [activeTab, setActiveTab] = useState<"my" | "public">("my");
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);
  
  const [joinCode, setJoinCode] = useState("");
  const [isJoining, setIsJoining] = useState(false);
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomVisibility, setNewRoomVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [isCreating, setIsCreating] = useState(false);

  const fetchRooms = async () => {
    try {
      setIsLoadingRooms(true);
      const data = await fetchApi("/rooms");
      setRooms(data);
      
      const pubData = await fetchApi("/rooms/public");
      setPublicRooms(pubData);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch rooms");
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;

    if (!isAuthenticated) {
      router.push("/login");
      return;
    }
    fetchRooms();
  }, [hasHydrated, isAuthenticated, router]);

  if (!hasHydrated || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-[#0d0e15] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#ff2d46] animate-spin" />
      </div>
    );
  }

  const confirmLogout = () => {
    logout();
    setShowLogoutModal(false);
    toast.success("Signed out successfully");
    router.push("/");
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;

    try {
      setIsJoining(true);
      const result = await fetchApi("/rooms/join", {
        method: "POST",
        body: JSON.stringify({ inviteCode: joinCode.trim() }),
      });
      toast.success("Joined room!");
      router.push(`/room/${result.roomId || result.room?.id}`);
    } catch (err: any) {
      if (err.message?.includes("Already a member")) {
        const existing = rooms.find(r => r.inviteCode === joinCode.trim());
        if (existing) {
          router.push(`/room/${existing.id}`);
          return;
        }
      }
      toast.error(err.message || "Could not join room");
    } finally {
      setIsJoining(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) {
      toast.error("Please enter a room name");
      return;
    }

    try {
      setIsCreating(true);
      const newRoom = await fetchApi("/rooms", {
        method: "POST",
        body: JSON.stringify({ name: newRoomName.trim(), visibility: newRoomVisibility }),
      });
      toast.success("Room created successfully!");
      setIsCreateModalOpen(false);
      setNewRoomName("");
      router.push(`/room/${newRoom.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create room");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0c0c0e] text-[#f4f4f5] font-sans relative">
      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-[#141417] border border-[#27272a] rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl text-center relative overflow-hidden"
            >
              <button
                onClick={() => setShowLogoutModal(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-[#1e1e24] border border-[#2d2d35] transition-colors"
              >
                <X size={16} />
              </button>

              <div className="w-16 h-16 rounded-full bg-[#ff2d46]/10 border border-[#ff2d46]/30 text-[#ff2d46] flex items-center justify-center mx-auto mb-4">
                <LogOut size={28} />
              </div>

              <h3 className="text-xl sm:text-2xl font-black text-white mb-2 tracking-tight">
                Sign Out of ListenIn?
              </h3>
              <p className="text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
                Are you sure you want to sign out? You will need to log in again to host or join live rooms.
              </p>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogoutModal(false)}
                  className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmLogout}
                  className="flex-1 bg-[#ff2d46] hover:bg-[#e11d48] text-white px-5 py-2.5 rounded-full font-bold text-xs sm:text-sm transition-colors shadow-lg shadow-red-950/50 flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dashboard Top Header */}
      <header className="px-4 py-3 sm:px-8 sm:py-4 border-b border-[#1f1f23] bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
        <Logo size="sm" />
        
        <button 
          onClick={() => setShowLogoutModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border border-[#27272a] bg-[#141417] text-zinc-400 hover:text-white hover:border-zinc-700 transition-all text-xs sm:text-sm font-medium"
        >
          <LogOut size={14} className="sm:w-4 sm:h-4" />
          <span>Sign Out</span>
        </button>
      </header>

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-10">
        {/* Mobile-Optimized Welcome Hero Card */}
        <section className="bg-[#141417] border border-[#27272a] rounded-3xl p-6 sm:p-8 mb-8 relative overflow-hidden shadow-2xl">
          <div className="absolute -inset-10 bg-gradient-to-r from-[#ff2d46]/10 via-transparent to-[#ff2d46]/5 blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
                Welcome back, <span className="text-[#ff2d46]">{user.username}</span>
              </h1>
              <p className="text-zinc-400 text-xs sm:text-sm mt-1 max-w-xl">
                Create a room to host your own audio party or enter an invite code to join friends live.
              </p>
            </div>
          </div>
        </section>

        {/* Action Controls (Create Room & Join Room Code) */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {/* Create Room Button */}
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-[#ff2d46] hover:bg-[#e11d48] text-white p-5 rounded-2xl flex items-center justify-center gap-3 font-bold text-sm sm:text-base transition-all shadow-lg shadow-red-950/40 group active:scale-[0.98]"
          >
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus size={20} />
            </div>
            Create New Listening Room
          </button>

          {/* Join Room Form */}
          <form onSubmit={handleJoin} className="bg-[#141417] border border-[#27272a] p-3 sm:p-4 rounded-2xl flex items-center gap-2 shadow-lg">
            <div className="relative flex-1 flex items-center">
              <KeyRound className="absolute left-3.5 text-zinc-500" size={18} />
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter 6-digit Invite Code..."
                className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl py-2.5 pl-10 pr-3 text-xs sm:text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff2d46]"
              />
            </div>
            <button 
              type="submit"
              disabled={!joinCode.trim() || isJoining}
              className="bg-white hover:bg-zinc-200 text-black px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold disabled:opacity-50 transition-opacity flex items-center gap-2 shrink-0"
            >
              {isJoining && <Loader2 size={14} className="animate-spin" />}
              Join
            </button>
          </form>
        </section>

        {/* Rooms Section Header with Tabs */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#27272a] pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab("my")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "my" 
                    ? "bg-[#ff2d46] text-white shadow-md shadow-red-950/40" 
                    : "bg-[#141417] text-zinc-400 hover:text-white border border-[#27272a]"
                }`}
              >
                <Headphones size={16} />
                Your Rooms ({rooms.length})
              </button>

              <button
                onClick={() => setActiveTab("public")}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                  activeTab === "public" 
                    ? "bg-[#ff2d46] text-white shadow-md shadow-red-950/40" 
                    : "bg-[#141417] text-zinc-400 hover:text-white border border-[#27272a]"
                }`}
              >
                <Globe size={16} />
                Explore Public Parties ({publicRooms.length})
              </button>
            </div>

            <button 
              onClick={fetchRooms}
              className="text-xs text-zinc-400 hover:text-white transition-colors self-end sm:self-auto"
            >
              Refresh List
            </button>
          </div>
          
          {isLoadingRooms ? (
            <div className="bg-[#141417] border border-[#27272a] p-10 sm:p-12 rounded-3xl text-center flex flex-col items-center justify-center">
              <Loader2 size={32} className="animate-spin text-[#ff2d46] mb-3" />
              <p className="text-zinc-400 text-xs sm:text-sm">Loading rooms...</p>
            </div>
          ) : activeTab === "my" ? (
            rooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {rooms.map((room) => (
                  <RoomCard 
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    memberCount={room.members?.length || room._count?.members || 1}
                    isHost={room.hostId === user.id}
                    isActive={true}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-[#141417] border border-[#27272a] p-10 sm:p-12 rounded-3xl text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#1e1e24] border border-[#2d2d35] flex items-center justify-center text-[#ff2d46] mb-3">
                  <Headphones size={26} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No personal rooms found</h3>
                <p className="text-zinc-400 text-xs sm:text-sm max-w-sm">
                  Create a room above to host your first listening party, or explore public parties tab!
                </p>
              </div>
            )
          ) : (
            publicRooms.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {publicRooms.map((room) => (
                  <RoomCard 
                    key={room.id}
                    id={room.id}
                    name={room.name}
                    memberCount={room.members?.length || room._count?.members || 1}
                    isHost={room.hostId === user.id}
                    isActive={true}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-[#141417] border border-[#27272a] p-10 sm:p-12 rounded-3xl text-center flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-[#1e1e24] border border-[#2d2d35] flex items-center justify-center text-[#ff2d46] mb-3">
                  <Globe size={26} />
                </div>
                <h3 className="text-lg font-bold text-white mb-1">No active public rooms right now</h3>
                <p className="text-zinc-400 text-xs sm:text-sm max-w-sm">
                  Be the first to create a public room and host audio live for everyone!
                </p>
              </div>
            )
          )}
        </section>
      </main>

      {/* Create Room Red & White Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={() => !isCreating && setIsCreateModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-[#141417] border border-[#27272a] p-6 sm:p-8 rounded-3xl w-full max-w-md relative z-10 shadow-2xl overflow-hidden"
            >
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-[#1e1e24] border border-[#2d2d35] transition-colors"
              >
                <X size={16} />
              </button>

              <h2 className="text-xl sm:text-2xl font-black text-white mb-1 tracking-tight">Create Listening Room</h2>
              <p className="text-zinc-400 text-xs sm:text-sm mb-6">Give your room a cool name to start hosting live.</p>
              
              <form onSubmit={handleCreateRoom} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-zinc-300 mb-1.5 block uppercase tracking-wider">Room Name</label>
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full bg-[#27272a] border border-[#3f3f46] rounded-xl py-3 px-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff2d46]"
                    placeholder="E.g., Squad Music Lounge"
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-zinc-300 mb-1.5 block uppercase tracking-wider">Room Visibility</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewRoomVisibility("PUBLIC")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        newRoomVisibility === "PUBLIC"
                          ? "bg-[#ff2d46]/20 border-[#ff2d46] text-[#ff2d46]"
                          : "bg-[#27272a] border-[#3f3f46] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Globe size={14} />
                      Public Party
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoomVisibility("PRIVATE")}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                        newRoomVisibility === "PRIVATE"
                          ? "bg-[#ff2d46]/20 border-[#ff2d46] text-[#ff2d46]"
                          : "bg-[#27272a] border-[#3f3f46] text-zinc-400 hover:text-white"
                      }`}
                    >
                      <Lock size={14} />
                      Invite-Only
                    </button>
                  </div>
                </div>
                
                <div className="pt-2 flex gap-3">
                  <button 
                    type="button"
                    disabled={isCreating}
                    onClick={() => setIsCreateModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-[#27272a] bg-[#1e1e24] text-white font-bold text-xs sm:text-sm hover:bg-[#27272a] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating || !newRoomName.trim()}
                    className="flex-1 py-3 rounded-xl bg-[#ff2d46] hover:bg-[#e11d48] text-white font-bold text-xs sm:text-sm shadow-md shadow-red-950/50 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                  >
                    {isCreating ? <Loader2 size={16} className="animate-spin" /> : "Create Room"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
