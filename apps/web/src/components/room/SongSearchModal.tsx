"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Link as LinkIcon, Music, Plus, Check, Loader2, X, Disc, Play, Headphones } from "lucide-react";
import { toast } from "sonner";
import { fetchApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";

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

interface SongSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  isHost: boolean;
  onAddTrackToQueue: (track: { title: string; artist: string; coverUrl: string; sourceUrl: string; audioUrl?: string; duration?: number }) => void;
}

export function SongSearchModal({ isOpen, onClose, roomId, isHost, onAddTrackToQueue }: SongSearchModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'link'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [addedTracks, setAddedTracks] = useState<Set<string>>(new Set());

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setLinkInput('');
      setSearchResults([]);
      setAddedTracks(new Set());
      setActiveTab('search');
    }
  }, [isOpen]);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setSearchResults([]);

    try {
      const results = await fetchApi(`/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(results || []);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search for songs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveLink = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!linkInput.trim()) return;

    setIsLoading(true);
    setSearchResults([]);

    try {
      const results = await fetchApi('/spotify/resolve-url', {
        method: 'POST',
        body: JSON.stringify({ url: linkInput }),
      });
      setSearchResults(results || []);
    } catch (error) {
      console.error('Resolve error:', error);
      toast.error('Failed to resolve link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = (track: SpotifyTrack) => {
    onAddTrackToQueue({
      title: track.title,
      artist: track.artist,
      coverUrl: track.coverUrl,
      sourceUrl: track.spotifyUrl,
      audioUrl: track.audioUrl,
      duration: Math.round(track.durationMs / 1000),
    });
    setAddedTracks(prev => new Set(prev).add(track.id));
    toast.success(`Added "${track.title}" to queue`);
  };

  const handlePlayNow = (track: SpotifyTrack) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('music:play', {
        roomId,
        title: track.title,
        artist: track.artist,
        coverUrl: track.coverUrl,
        audioUrl: track.audioUrl,
        duration: Math.round(track.durationMs / 1000),
      });
    }
    toast.success(`▶ Playing "${track.title}" for everyone!`);
    onClose();
  };

  const formatDuration = (ms: number) => {
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative z-10 w-full max-w-2xl overflow-hidden rounded-3xl bg-[#141417] shadow-2xl backdrop-blur-xl border border-[#27272a] max-h-[85vh] flex flex-col my-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 pb-4 border-b border-[#27272a]">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#ff2d46] to-[#ff6b7d] text-white shadow-lg shadow-[#ff2d46]/20">
                  <Music className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-white">Music Engine</h2>
                    <span className="rounded-md bg-[#ff2d46]/20 px-2 py-0.5 text-xs font-medium text-[#ff2d46]">
                      320kbps
                    </span>
                  </div>
                  <p className="text-sm text-zinc-400">Search millions of songs • High quality audio</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="rounded-full p-2 text-zinc-400 hover:bg-[#27272a] hover:text-white transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 px-6 pt-4 border-b border-[#27272a]">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === 'search'
                    ? 'border-b-2 border-[#ff2d46] text-[#ff2d46]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Search className="h-4 w-4" />
                Search Songs
              </button>
              <button
                onClick={() => setActiveTab('link')}
                className={`flex items-center gap-2 pb-3 text-sm font-medium transition-colors ${
                  activeTab === 'link'
                    ? 'border-b-2 border-[#ff2d46] text-[#ff2d46]'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                Paste Link
              </button>
            </div>

            {/* Content Area */}
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6">
                {activeTab === 'search' ? (
                  <form onSubmit={handleSearch} className="flex gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Song title, artist, or album..."
                        className="w-full rounded-2xl border border-[#27272a] bg-[#1a1a1e] py-3 pl-12 pr-4 text-white placeholder:text-zinc-500 focus:border-[#ff2d46] focus:outline-none focus:ring-1 focus:ring-[#ff2d46] transition-all"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!searchQuery.trim() || isLoading}
                      className="flex items-center justify-center rounded-2xl bg-[#ff2d46] px-6 font-semibold text-white hover:bg-[#e11d48] disabled:opacity-50 disabled:hover:bg-[#ff2d46] transition-colors"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Search'}
                    </button>
                  </form>
                ) : (
                  <form onSubmit={handleResolveLink} className="flex gap-3">
                    <div className="relative flex-1">
                      <LinkIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="text"
                        value={linkInput}
                        onChange={(e) => setLinkInput(e.target.value)}
                        placeholder="Paste a Spotify URL..."
                        className="w-full rounded-2xl border border-[#27272a] bg-[#1a1a1e] py-3 pl-12 pr-4 text-white placeholder:text-zinc-500 focus:border-[#ff2d46] focus:outline-none focus:ring-1 focus:ring-[#ff2d46] transition-all"
                        autoFocus
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!linkInput.trim() || isLoading}
                      className="flex items-center justify-center rounded-2xl bg-[#ff2d46] px-6 font-semibold text-white hover:bg-[#e11d48] disabled:opacity-50 disabled:hover:bg-[#ff2d46] transition-colors"
                    >
                      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Find'}
                    </button>
                  </form>
                )}
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto px-6 pb-6">
                {isLoading ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center mb-4">
                      <p className="text-sm text-zinc-500 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Searching millions of tracks...
                      </p>
                    </div>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 w-full animate-pulse rounded-2xl bg-[#1a1a1e] border border-[#27272a]"></div>
                    ))}
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-3">
                    {searchResults.map((track) => (
                      <div
                        key={track.id}
                        className="group flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#27272a] bg-[#1a1a1e] p-3 hover:border-[#ff2d46]/30 transition-colors relative"
                      >
                        <div className="flex items-center gap-4 min-w-0 pr-8 sm:pr-0">
                          <img
                            src={track.coverUrl}
                            alt={track.album}
                            className="h-12 w-12 flex-shrink-0 rounded-xl object-cover shadow-md"
                          />
                          <div className="flex flex-col overflow-hidden">
                            <span className="truncate font-semibold text-white group-hover:text-[#ff2d46] transition-colors">
                              {track.title}
                            </span>
                            <span className="truncate text-sm text-zinc-400">
                              {track.artist} <span className="text-zinc-600 px-1">•</span> {track.album}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 ml-16 sm:ml-0 shrink-0">
                          {isHost && (
                            <button
                              onClick={() => handlePlayNow(track)}
                              className="flex items-center gap-1.5 rounded-full bg-[#ff2d46] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#e11d48] transition-colors shadow-sm shadow-[#ff2d46]/20 z-10 relative"
                            >
                              <Play className="h-3.5 w-3.5 fill-current" />
                              Play
                            </button>
                          )}
                          <button
                            onClick={() => handleAdd(track)}
                            disabled={addedTracks.has(track.id)}
                            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors z-10 relative ${
                              addedTracks.has(track.id)
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-[#27272a] text-white hover:bg-[#3f3f46]'
                            }`}
                          >
                            {addedTracks.has(track.id) ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                Added
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                Queue
                              </>
                            )}
                          </button>
                        </div>
                        
                        {/* Duration Badge */}
                        <div className="absolute bottom-2 right-3 text-[10px] text-zinc-500 font-medium">
                          {formatDuration(track.durationMs)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (searchQuery || linkInput) && !isLoading ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Disc className="mb-4 h-12 w-12 text-zinc-600" />
                    <h3 className="mb-1 font-bold text-zinc-400">No tracks found</h3>
                    <p className="text-xs text-zinc-500">Try a different search term or check your link</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="mb-6 rounded-full bg-[#1a1a1e] p-5 shadow-inner border border-[#27272a]">
                      <Headphones className="h-10 w-10 text-zinc-600" />
                    </div>
                    <h3 className="mb-2 text-lg font-bold text-zinc-400">Search for any song</h3>
                    <p className="text-xs text-zinc-500 max-w-xs">
                      Type a song title, artist name, or paste a Spotify link to start listening
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
