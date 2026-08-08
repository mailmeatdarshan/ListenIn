"use client";

import React from "react";
import { Music, SkipForward, Trash2, Plus, Disc, Sparkles } from "lucide-react";

export interface QueueItem {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  audioUrl?: string;
  sourceUrl?: string;
  duration?: number;
  suggestedByUser?: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
}

interface QueuePanelProps {
  queue: QueueItem[];
  isHost: boolean;
  onOpenSpotifyModal: () => void;
  onRemoveQueueItem?: (suggestionId: string) => void;
  onPlayNextQueueTrack?: () => void;
}

export function QueuePanel({
  queue,
  isHost,
  onOpenSpotifyModal,
  onRemoveQueueItem,
  onPlayNextQueueTrack,
}: QueuePanelProps) {
  const currentTrack = queue[0];
  const upcomingQueue = queue.slice(1);

  return (
    <div className="flex flex-col h-full bg-[#141417] border-l border-[#27272a] p-4 md:p-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#27272a] shrink-0 mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1db954]/10 border border-[#1db954]/30 flex items-center justify-center text-[#1db954]">
            <Music size={16} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              Live Room Queue
            </h3>
            <p className="text-[11px] text-zinc-400">{queue.length} track(s) in queue</p>
          </div>
        </div>

        {/* Add Song Button */}
        <button
          onClick={onOpenSpotifyModal}
          className="bg-[#1db954] hover:bg-[#1ed760] text-black px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shadow-md hover:scale-105"
        >
          <Plus size={14} />
          <span>Add Song</span>
        </button>
      </div>

      {/* Queue Content Container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {/* Currently Up / Now Playing from Queue */}
        {currentTrack ? (
          <div className="bg-[#1a1a1e] border border-[#1db954]/40 p-4 rounded-2xl relative overflow-hidden group shadow-lg">
            <div className="flex items-center gap-1.5 text-[#1db954] text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles size={12} className="animate-spin" />
              <span>Next Up in Queue</span>
            </div>

            <div className="flex items-center gap-3">
              {currentTrack.coverUrl ? (
                <img src={currentTrack.coverUrl} alt={currentTrack.title} className="w-14 h-14 rounded-xl object-cover shrink-0 shadow-md" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-[#27272a] flex items-center justify-center text-zinc-400 shrink-0">
                  <Disc size={24} />
                </div>
              )}

              <div className="overflow-hidden flex-1">
                <h4 className="text-sm font-bold text-white truncate">{currentTrack.title}</h4>
                <p className="text-xs text-zinc-400 truncate">{currentTrack.artist || "Spotify Track"}</p>
                {currentTrack.suggestedByUser && (
                  <p className="text-[10px] text-zinc-500 mt-1">Suggested by <strong className="text-zinc-300">{currentTrack.suggestedByUser.username}</strong></p>
                )}
              </div>
            </div>

            {/* Host Skip Control */}
            {isHost && onPlayNextQueueTrack && (
              <button
                onClick={onPlayNextQueueTrack}
                className="mt-3 w-full bg-[#1db954]/20 hover:bg-[#1db954]/30 border border-[#1db954]/40 text-[#1db954] py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <SkipForward size={14} />
                Play Next Track Now
              </button>
            )}
          </div>
        ) : null}

        {/* Upcoming List */}
        <div>
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Upcoming ({upcomingQueue.length})</h4>

          {upcomingQueue.length > 0 ? (
            <div className="space-y-2">
              {upcomingQueue.map((item, index) => (
                <div
                  key={item.id}
                  className="bg-[#1e1e24]/60 border border-[#2d2d35] hover:border-[#3f3f46] rounded-xl p-3 flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-xs font-bold text-zinc-500 w-4 text-center shrink-0">{index + 1}</span>
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-[#27272a] flex items-center justify-center text-zinc-500 shrink-0">
                        <Disc size={16} />
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <h5 className="text-xs font-bold text-white truncate">{item.title}</h5>
                      <p className="text-[11px] text-zinc-400 truncate">{item.artist || "Spotify Track"}</p>
                    </div>
                  </div>

                  {isHost && onRemoveQueueItem && (
                    <button
                      onClick={() => onRemoveQueueItem(item.id)}
                      className="text-zinc-500 hover:text-red-400 p-1.5 rounded-full hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                      title="Remove from Queue"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#1e1e24]/40 border border-[#27272a] rounded-2xl p-6 text-center">
              <Disc size={28} className="text-zinc-600 mx-auto mb-2" />
              <p className="text-xs font-bold text-zinc-400">Queue is empty</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Click "Add Song" to search Spotify and queue music for the party!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
