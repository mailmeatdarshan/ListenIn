"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Music, Search, Disc } from "lucide-react";
import { motion } from "framer-motion";
import { LogoIcon } from "@/components/Logo";
import { getSocket } from "@/lib/socket";
import { NowPlaying } from "@/lib/stores/room-store";
import { audioManager } from "@/lib/audio-manager";

interface MonochromePlayerProps {
  nowPlaying: NowPlaying | null;
  isHost: boolean;
  roomId: string;
  onSearchClick: () => void;
  onPlayNext: () => void;
  hasQueueItems: boolean;
}

const formatTime = (s: number) => {
  if (isNaN(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
};

export const MonochromePlayer: React.FC<MonochromePlayerProps> = ({
  nowPlaying,
  isHost,
  roomId,
  onSearchClick,
  onPlayNext,
  hasQueueItems,
}) => {
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const reqRef = useRef<number>();

  // Attach ended listener
  useEffect(() => {
    const el = audioManager.getAudioElement();
    if (!el) return;

    const handleEnded = () => {
      if (isHost) {
        onPlayNext();
      }
    };
    el.addEventListener("ended", handleEnded);
    return () => {
      el.removeEventListener("ended", handleEnded);
    };
  }, [isHost, onPlayNext]);

  // Sync volume and mute
  useEffect(() => {
    audioManager.setVolume(volume);
    audioManager.setMuted(isMuted);
  }, [volume, isMuted]);

  // Handle song changes and playback state via AudioManager
  useEffect(() => {
    if (!nowPlaying) {
      audioManager.pause();
      return;
    }

    audioManager.playTrack({
      audioUrl: nowPlaying.audioUrl,
      startedAt: nowPlaying.startedAt,
      isPlaying: nowPlaying.isPlaying,
      seekPosition: nowPlaying.seekPosition,
      duration: nowPlaying.duration,
    });
  }, [nowPlaying?.id, nowPlaying?.audioUrl, nowPlaying?.isPlaying, nowPlaying?.startedAt, nowPlaying?.seekPosition, nowPlaying?.duration]);

  // Update current time for UI
  const updateProgress = useCallback(() => {
    if (nowPlaying?.isPlaying) {
      setCurrentTime(audioManager.getCurrentTime());
    }
    reqRef.current = requestAnimationFrame(updateProgress);
  }, [nowPlaying?.isPlaying]);

  useEffect(() => {
    if (nowPlaying?.isPlaying) {
      reqRef.current = requestAnimationFrame(updateProgress);
    }
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [nowPlaying?.isPlaying, updateProgress]);

  const handleTogglePlay = () => {
    if (!isHost || !nowPlaying) return;
    const socket = getSocket();
    const curr = audioManager.getCurrentTime();

    if (nowPlaying.isPlaying) {
      socket?.emit("music:pause", { roomId, currentTime: curr });
    } else {
      socket?.emit("music:resume", { roomId, currentTime: curr });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isHost || !nowPlaying) return;
    const seekTo = parseFloat(e.target.value);
    audioManager.seek(seekTo);
    const socket = getSocket();
    socket?.emit("music:seek", { roomId, seekTo });
  };

  // Render idle state
  if (!nowPlaying) {
    return (
      <div className="monochrome-glass rounded-3xl p-6 md:p-8 w-full relative overflow-hidden flex flex-col items-center justify-center min-h-[260px] border border-white/10">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="mb-4 text-zinc-600"
        >
          <Disc size={64} className="opacity-50" />
        </motion.div>
        <h3 className="text-lg md:text-xl font-bold text-zinc-300 mb-1">No Track Playing</h3>
        <p className="text-xs text-zinc-500 mb-6 text-center max-w-sm">
          {isHost
            ? "Search any song or choose a track to broadcast live to everyone in the room."
            : "Waiting for host to play a song..."}
        </p>
        {isHost && (
          <button
            onClick={onSearchClick}
            className="bg-[#ff2d46] hover:bg-[#e11d48] text-white rounded-full px-6 py-2.5 font-bold flex items-center gap-2 transition-all shadow-lg shadow-red-500/20 active:scale-95"
          >
            <Search size={18} />
            Search & Play Music
          </button>
        )}
      </div>
    );
  }

  const duration = nowPlaying.duration || 0;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="monochrome-glass rounded-3xl p-6 md:p-8 w-full relative overflow-hidden shadow-2xl border border-white/10">
      {/* Ambient Glow */}
      {nowPlaying.coverUrl && (
        <div
          className="monochrome-glow z-0"
          style={{ backgroundImage: `url(${nowPlaying.coverUrl})`, backgroundSize: "cover" }}
        />
      )}

      <div className="relative z-10 flex flex-col md:flex-row gap-6 md:gap-8 items-center md:items-stretch">
        {/* LEFT: Album Artwork */}
        <div className="relative w-[140px] h-[140px] md:w-[180px] md:h-[180px] shrink-0">
          <div className="w-full h-full rounded-2xl shadow-2xl overflow-hidden bg-zinc-900 border border-white/10 flex items-center justify-center">
            {nowPlaying.coverUrl ? (
              <img src={nowPlaying.coverUrl} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <Disc size={48} className="text-zinc-700" />
            )}
          </div>
          {/* Spinning Vinyl */}
          <div
            className={`absolute -bottom-2 -right-2 w-10 h-10 rounded-full border-2 border-[#141417] shadow-xl overflow-hidden bg-gradient-to-br from-zinc-800 to-black flex items-center justify-center ${
              nowPlaying.isPlaying ? "vinyl-spinning" : "vinyl-paused"
            }`}
          >
            <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center">
              <LogoIcon className="w-4 h-4" />
            </div>
          </div>
        </div>

        {/* RIGHT: Track Info + Controls */}
        <div className="flex-1 min-w-0 w-full flex flex-col justify-center">
          {/* Quality Badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 h-4">
              {nowPlaying.isPlaying && (
                <div className="flex items-end gap-[2px] h-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="eq-bar w-[3px] bg-[#ff2d46] rounded-t-sm"
                      style={{
                        '--eq-height': `${12 + Math.random() * 12}px`,
                        '--eq-delay': `${Math.random() * 0.5}s`,
                        '--eq-duration': `${0.5 + Math.random() * 0.5}s`
                      } as React.CSSProperties}
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="bg-white/5 border border-white/10 text-zinc-400 text-[9px] font-bold uppercase px-2 py-0.5 rounded-full tracking-wider">
              320kbps • HD AUDIO
            </div>
          </div>

          <h2 className="text-xl md:text-2xl font-black text-white tracking-tight truncate">
            {nowPlaying.title}
          </h2>
          <p className="text-sm text-zinc-400 font-medium truncate mt-0.5">
            {nowPlaying.artist}
          </p>

          {/* Seekbar */}
          <div className="mt-5 w-full">
            <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-2">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
            <div className="relative w-full h-1.5">
              {/* Custom Track Background */}
              <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-red-500 to-[#ff2d46]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <input
                type="range"
                className="monochrome-range w-full absolute inset-0 opacity-0 md:opacity-100 mix-blend-screen"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={handleSeek}
                disabled={!isHost}
              />
            </div>
          </div>

          {/* Playback Controls & Volume */}
          <div className="mt-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <button
                disabled={!isHost || (!hasQueueItems && !nowPlaying)}
                onClick={() => isHost && onPlayNext()}
                className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Previous Track"
              >
                <SkipBack size={24} className="md:w-7 md:h-7" />
              </button>
              
              <button
                onClick={handleTogglePlay}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all ${
                  isHost ? "bg-white text-black hover:scale-105 active:scale-95" : "bg-white/20 text-white/50 cursor-not-allowed"
                }`}
                title={isHost ? (nowPlaying.isPlaying ? "Pause" : "Play") : "Host controls playback"}
              >
                {nowPlaying.isPlaying ? (
                  <Pause size={28} className="fill-current" />
                ) : (
                  <Play size={28} className="fill-current ml-1" />
                )}
              </button>
              
              <button
                disabled={!isHost}
                onClick={() => isHost && onPlayNext()}
                className="text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Next Track"
              >
                <SkipForward size={24} className="md:w-7 md:h-7" />
              </button>
            </div>

            <div className="flex items-center gap-3 md:w-32">
              <button
                onClick={() => setIsMuted(!isMuted)}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <div className="relative w-full h-1.5 group">
                <div className="absolute inset-0 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-300 transition-all group-hover:bg-white"
                    style={{ width: `${isMuted ? 0 : volume * 100}%` }}
                  />
                </div>
                <input
                  type="range"
                  className="monochrome-range w-full absolute inset-0 opacity-0 group-hover:opacity-100 cursor-pointer"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
