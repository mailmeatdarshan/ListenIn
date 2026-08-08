"use client";

import React from "react";
import { motion } from "framer-motion";
import { X, Palette, Disc, Check } from "lucide-react";

export type VinylStyle = "CLASSIC" | "RED_NEON" | "RETRO_GOLD" | "CYBERPUNK";
export type BackgroundTheme = "RED_WHITE" | "MIDNIGHT_BLUE" | "CYBERPUNK_VIOLET" | "EMERALD_GREEN";

export interface RoomThemeConfig {
  vinylStyle: VinylStyle;
  bgTheme: BackgroundTheme;
}

interface RoomThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: RoomThemeConfig;
  onSelectTheme: (newTheme: RoomThemeConfig) => void;
}

const VINYL_PRESETS: { id: VinylStyle; name: string; gradient: string }[] = [
  { id: "CLASSIC", name: "Classic Glossy", gradient: "from-[#1f1f23] via-[#09090b] to-[#27272a]" },
  { id: "RED_NEON", name: "Red Neon", gradient: "from-[#ff2d46] via-[#7f1d1d] to-[#000000]" },
  { id: "RETRO_GOLD", name: "Retro Gold", gradient: "from-[#f59e0b] via-[#78350f] to-[#18181b]" },
  { id: "CYBERPUNK", name: "Cyberpunk Glow", gradient: "from-[#06b6d4] via-[#4c1d95] to-[#0f172a]" },
];

const BG_THEMES: { id: BackgroundTheme; name: string; glowGradient: string; accentColor: string }[] = [
  { id: "RED_WHITE", name: "Signature Red & White", glowGradient: "from-[#ff2d46]/20 via-transparent to-[#ff2d46]/10", accentColor: "#ff2d46" },
  { id: "MIDNIGHT_BLUE", name: "Midnight Electric Blue", glowGradient: "from-[#3b82f6]/20 via-transparent to-[#1d4ed8]/10", accentColor: "#3b82f6" },
  { id: "CYBERPUNK_VIOLET", name: "Neon Violet Party", glowGradient: "from-[#a855f7]/20 via-transparent to-[#ec4899]/10", accentColor: "#a855f7" },
  { id: "EMERALD_GREEN", name: "Emerald Cyber Beats", glowGradient: "from-[#10b981]/20 via-transparent to-[#059669]/10", accentColor: "#10b981" },
];

export function RoomThemeModal({ isOpen, onClose, currentTheme, onSelectTheme }: RoomThemeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-[#141417] border border-[#27272a] p-6 sm:p-8 rounded-3xl w-full max-w-lg relative z-10 shadow-2xl overflow-hidden"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 rounded-full bg-[#1e1e24] border border-[#2d2d35] transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-center gap-2 mb-1">
          <Palette className="text-[#ff2d46]" size={22} />
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">Room Theme & Vinyl Art</h2>
        </div>
        <p className="text-zinc-400 text-xs sm:text-sm mb-6">Customize the vinyl disk art and background ambient glow for all live listeners.</p>

        {/* Vinyl Style Selector */}
        <div className="mb-6">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-3 flex items-center gap-1.5">
            <Disc size={14} className="text-[#ff2d46]" /> Vinyl Disk Texture
          </label>
          <div className="grid grid-cols-2 gap-3">
            {VINYL_PRESETS.map((v) => (
              <button
                key={v.id}
                onClick={() => onSelectTheme({ ...currentTheme, vinylStyle: v.id })}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                  currentTheme.vinylStyle === v.id
                    ? "bg-[#ff2d46]/10 border-[#ff2d46] text-white"
                    : "bg-[#1e1e24] border-[#2d2d35] text-zinc-400 hover:text-white"
                }`}
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-tr ${v.gradient} border border-white/20 shrink-0 flex items-center justify-center`}>
                  {currentTheme.vinylStyle === v.id && <Check size={14} className="text-white" />}
                </div>
                <span className="text-xs font-bold truncate">{v.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Ambient Glow Selector */}
        <div className="mb-6">
          <label className="text-xs font-bold text-zinc-300 uppercase tracking-wider block mb-3">
            Background Ambient Glow
          </label>
          <div className="grid grid-cols-2 gap-3">
            {BG_THEMES.map((b) => (
              <button
                key={b.id}
                onClick={() => onSelectTheme({ ...currentTheme, bgTheme: b.id })}
                className={`p-3 rounded-2xl border flex items-center gap-3 transition-all ${
                  currentTheme.bgTheme === b.id
                    ? "bg-[#ff2d46]/10 border-[#ff2d46] text-white"
                    : "bg-[#1e1e24] border-[#2d2d35] text-zinc-400 hover:text-white"
                }`}
              >
                <div 
                  className="w-5 h-5 rounded-full border border-white/20 shrink-0 flex items-center justify-center shadow-md"
                  style={{ backgroundColor: b.accentColor }}
                >
                  {currentTheme.bgTheme === b.id && <Check size={12} className="text-white" />}
                </div>
                <span className="text-xs font-bold truncate">{b.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-[#ff2d46] hover:bg-[#e11d48] text-white font-bold text-xs sm:text-sm shadow-md shadow-red-950/50 transition-colors"
        >
          Apply Theme
        </button>
      </motion.div>
    </div>
  );
}
