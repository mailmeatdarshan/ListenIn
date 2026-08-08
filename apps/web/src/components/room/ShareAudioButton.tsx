"use client";

import React, { useState } from "react";
import { MicOff, Cast, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startHostAudioStream, stopHostAudioStream } from "@/lib/webrtc-audio";
import { publishSystemAudio, stopPublishingAudio } from "@/lib/livekit";

interface ShareAudioButtonProps {
  isHost: boolean;
  roomId: string;
  isRelaying?: boolean;
  onRelayStateChange?: (isRelaying: boolean) => void;
  onStreamCapture?: (stream: MediaStream | null) => void;
}

export function ShareAudioButton({ isHost, roomId, isRelaying, onRelayStateChange, onStreamCapture }: ShareAudioButtonProps) {
  const [isSharing, setIsSharing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const isCurrentlySharing = isSharing || !!isRelaying;

  const startSharing = async () => {
    try {
      setIsLoading(true);
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        }
      });
      
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        toast.error("No audio track selected. Make sure to check 'Share tab audio' in the browser prompt!");
        stream.getTracks().forEach(t => t.stop());
        setIsLoading(false);
        return;
      }

      // 1. Try LiveKit Cloud publish if configured
      try {
        await publishSystemAudio(stream);
      } catch (e) {
        console.warn("LiveKit Cloud fallback to Direct WebRTC Audio:", e);
      }

      // 2. Direct WebRTC P2P Audio Streaming
      await startHostAudioStream(stream, roomId);

      setIsSharing(true);
      if (onStreamCapture) onStreamCapture(stream);
      if (onRelayStateChange) onRelayStateChange(true);
      toast.success("Now broadcasting audio to everyone!");

      audioTrack.onended = () => {
        stopSharing();
      };
    } catch (err: any) {
      toast.error("Failed to share audio: " + (err.message || "Permission denied"));
    } finally {
      setIsLoading(false);
    }
  };

  const stopSharing = async () => {
    try {
      if (onStreamCapture) onStreamCapture(null);
      stopHostAudioStream(roomId);
      await stopPublishingAudio();
      
      setIsSharing(false);
      if (onRelayStateChange) onRelayStateChange(false);
      toast.info("Broadcast stopped");
    } catch (err: any) {
      toast.error("Error stopping broadcast: " + err.message);
    }
  };

  if (!isHost) return null;

  return (
    <button
      onClick={isCurrentlySharing ? stopSharing : startSharing}
      disabled={isLoading}
      className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all disabled:opacity-50 text-sm shadow-lg ${
        isCurrentlySharing 
          ? "bg-[#ff2d46]/20 text-[#ff2d46] hover:bg-[#ff2d46]/30 border border-[#ff2d46]/40" 
          : "bg-[#ff2d46] text-white hover:bg-[#e11d48]"
      }`}
    >
      {isLoading ? (
        <>
          <Loader2 size={18} className="animate-spin" />
          Connecting...
        </>
      ) : isCurrentlySharing ? (
        <>
          <MicOff size={18} />
          Stop Broadcast
        </>
      ) : (
        <>
          <Cast size={18} />
          Share System Audio
        </>
      )}
    </button>
  );
}
