"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Link as LinkIcon, Music, Plus, Check, Loader2, X, Disc } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  spotifyUrl: string;
  durationMs: number;
  audioUrl?: string;
}

interface SpotifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTrackToQueue: (track: { title: string; artist: string; coverUrl: string; sourceUrl: string; audioUrl?: string; duration?: number }) => void;
}

export function SpotifyModal({ isOpen, onClose, onAddTrackToQueue }: SpotifyModalProps) {
  const [activeTab, setActiveTab] = useState<"search" | "link">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [linkInput, setLinkInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [addedTrackIds, setAddedTrackIds] = useState<Set<string>>(new Set());

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    try {
      setIsSearching(true);
      const results = await fetchApi(`/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results || []);
    } catch (err: any) {
      toast.error("Failed to search Spotify: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResolveLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkInput.trim()) return;

    try {
      setIsSearching(true);
      const results = await fetchApi(`/spotify/resolve-url`, {
        method: "POST",
        body: JSON.stringify({ url: linkInput }),
      });
      setSearchResults(results || []);
      if (results && results.length > 0) {
        toast.success(`Found ${results.length} track(s) from link!`);
      } else {
        toast.error("No tracks found from link");
      }
    } catch (err: any) {
      toast.error("Invalid or unsupported Spotify link");
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddTrack = (track: SpotifyTrack) => {
    onAddTrackToQueue({
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl,
      sourceUrl: track.spotifyUrl || "",
      audioUrl: track.audioUrl,
      duration: Math.round(track.durationMs / 1000),
    });

    setAddedTrackIds((prev) => new Set(prev).add(track.id));
    toast.success(`Added "${track.title}" to room queue! 🎵`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#141417] border border-[#27272a] rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col relative z-10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 border-b border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1db954]/10 border border-[#1db954]/30 flex items-center justify-center text-[#1db954]">
              <Music size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                Spotify Music Engine <span className="bg-[#1db954]/20 text-[#1db954] text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-[#1db954]/30">Live</span>
              </h2>
              <p className="text-zinc-400 text-xs">Search songs or paste Spotify links to add to Room Queue</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1e1e24] hover:bg-[#2d2d35] text-zinc-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-[#27272a] bg-[#1a1a1e]">
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              activeTab === "search" ? "text-[#1db954] border-b-2 border-[#1db954] bg-[#141417]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Search size={14} /> Search Songs
          </button>
          <button
            onClick={() => setActiveTab("link")}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 transition-colors ${
              activeTab === "link" ? "text-[#1db954] border-b-2 border-[#1db954] bg-[#141417]" : "text-zinc-400 hover:text-white"
            }`}
          >
            <LinkIcon size={14} /> Paste Spotify Link
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 border-b border-[#27272a] bg-[#141417]">
          {activeTab === "search" ? (
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search song title, artist, or album..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#1a1a1e] border border-[#27272a] focus:border-[#1db954] text-white pl-10 pr-4 py-2.5 rounded-full text-sm outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !searchQuery.trim()}
                className="bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-full text-sm transition-colors flex items-center gap-2"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Search"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResolveLink} className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Paste Spotify track URL (e.g. https://open.spotify.com/track/...)"
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  className="w-full bg-[#1a1a1e] border border-[#27272a] focus:border-[#1db954] text-white pl-10 pr-4 py-2.5 rounded-full text-sm outline-none transition-colors"
                />
              </div>
              <button
                type="submit"
                disabled={isSearching || !linkInput.trim()}
                className="bg-[#1db954] hover:bg-[#1ed760] disabled:opacity-50 text-black font-bold px-6 py-2.5 rounded-full text-sm transition-colors flex items-center gap-2"
              >
                {isSearching ? <Loader2 size={16} className="animate-spin" /> : "Fetch Track"}
              </button>
            </form>
          )}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3 min-h-[250px]">
          {isSearching ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Loader2 size={32} className="animate-spin text-[#1db954] mb-3" />
              <p className="text-xs">Searching catalog...</p>
            </div>
          ) : searchResults.length > 0 ? (
            searchResults.map((track) => {
              const isAdded = addedTrackIds.has(track.id);
              return (
                <div
                  key={track.id}
                  className="bg-[#1a1a1e] border border-[#27272a] hover:border-[#1db954]/50 rounded-2xl p-3 flex items-center justify-between gap-3 transition-colors group"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {track.coverUrl ? (
                      <img src={track.coverUrl} alt={track.title} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#27272a] flex items-center justify-center text-zinc-400 shrink-0">
                        <Disc size={20} />
                      </div>
                    )}

                    <div className="overflow-hidden">
                      <h4 className="text-sm font-bold text-white truncate">{track.title}</h4>
                      <p className="text-xs text-zinc-400 truncate">{track.artist} • <span className="text-zinc-500">{track.album}</span></p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleAddTrack(track)}
                    disabled={isAdded}
                    className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                      isAdded
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                        : "bg-[#1db954] hover:bg-[#1ed760] text-black shadow-md hover:scale-105 active:scale-95"
                    }`}
                  >
                    {isAdded ? (
                      <>
                        <Check size={14} /> Added
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Add to Queue
                      </>
                    )}
                  </button>
                </div>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500">
              <Music size={36} className="text-zinc-600 mb-3" />
              <p className="text-sm font-bold text-zinc-400">Search for any song above</p>
              <p className="text-xs max-w-xs mt-1">Type song title or artist to discover millions of tracks and add to live party queue!</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
