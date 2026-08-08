import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Users, Crown, Play } from "lucide-react";

interface RoomCardProps {
  id: string;
  name: string;
  memberCount: number;
  isHost: boolean;
  isActive: boolean;
}

export function RoomCard({ id, name, memberCount, isHost, isActive }: RoomCardProps) {
  return (
    <Link href={`/room/${id}`}>
      <motion.div
        whileHover={{ y: -4 }}
        className="bg-[#141417] p-5 rounded-2xl border border-[#27272a] hover:border-[#ff2d46]/50 transition-all cursor-pointer group relative overflow-hidden shadow-lg"
      >
        <div className="flex justify-between items-start mb-4 relative z-10">
          <h3 className="text-lg sm:text-xl font-bold truncate pr-4 text-white group-hover:text-[#ff2d46] transition-colors">{name}</h3>
          {isActive && (
            <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ff2d46]/20 text-[#ff2d46] text-[10px] font-bold uppercase tracking-wider border border-[#ff2d46]/40">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff2d46] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#ff2d46]"></span>
              </span>
              Live
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs sm:text-sm text-zinc-400 relative z-10">
          <div className="flex items-center gap-1.5">
            <Users size={16} />
            <span>{memberCount} members</span>
          </div>
          {isHost && (
            <div className="flex items-center gap-1.5 text-[#ff2d46] font-semibold">
              <Crown size={16} />
              <span>Host</span>
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end relative z-10">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1f1f23] border border-[#27272a] flex items-center justify-center group-hover:bg-[#ff2d46] group-hover:border-[#ff2d46] group-hover:text-white text-zinc-400 transition-colors">
            <Play size={16} className="ml-0.5" fill="currentColor" />
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
