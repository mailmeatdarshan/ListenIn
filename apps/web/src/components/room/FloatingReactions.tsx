"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ActiveReaction {
  id: string;
  emoji: string;
  username: string;
  xOffset: number;
}

interface FloatingReactionsProps {
  reactions: ActiveReaction[];
  onSendReaction?: (emoji: string) => void;
  showBar?: boolean;
}

const PRESET_EMOJIS = ["🔥", "❤️", "🎵", "🚀", "👏", "🎉"];

export function FloatingReactions({ reactions, onSendReaction, showBar = true }: FloatingReactionsProps) {
  return (
    <>
      {/* Live Floating Reaction Particles Container (Full Screen Overlay) */}
      {reactions.length > 0 && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
          <AnimatePresence>
            {reactions.map((r) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: "90vh", x: `${r.xOffset}vw`, scale: 0.6, rotate: 0 }}
                animate={{ 
                  opacity: [0, 1, 1, 0], 
                  y: "-10vh", 
                  x: `${r.xOffset + (Math.sin(r.xOffset) * 10)}vw`,
                  scale: [0.6, 1.4, 1.2, 0.8],
                  rotate: [0, -15, 15, -10]
                }}
                exit={{ opacity: 0 }}
                transition={{ duration: 3.5, ease: "easeOut" }}
                className="absolute flex flex-col items-center select-none"
              >
                <span className="text-4xl sm:text-5xl filter drop-shadow-lg">{r.emoji}</span>
                <span className="text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded-full border border-white/10 mt-1 whitespace-nowrap">
                  {r.username}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Quick Reaction Bar UI (Horizontal Pills) */}
      {showBar && onSendReaction && (
        <div className="flex items-center gap-1.5 sm:gap-2 bg-[#141417] border border-[#27272a] p-1.5 rounded-full shadow-lg backdrop-blur-md">
          {PRESET_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => onSendReaction(emoji)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-[#1e1e24] hover:bg-[#ff2d46] hover:scale-125 text-base sm:text-lg flex items-center justify-center transition-all duration-200 active:scale-95 shadow-md"
              title={`React with ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
