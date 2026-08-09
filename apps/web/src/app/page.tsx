"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { 
  Sparkles, 
  Radio, 
  BarChart3, 
  Users, 
  ShieldCheck, 
  Volume2,
  VolumeX,
  Github
} from "lucide-react";
import React, { useState, useEffect, useRef } from "react";
import { Logo, LogoIcon } from "@/components/Logo";
import { useAuthStore } from "@/lib/stores/auth-store";

const AUDIO_START_TIME = 24; // 0:24
const AUDIO_END_TIME = 55;   // 0:55

export default function LandingPage() {
  const { isAuthenticated, hasHydrated } = useAuthStore();
  const isLoggedIn = hasHydrated && isAuthenticated;

  const [emailInput, setEmailInput] = useState("");
  const [subscribed, setSubscribed] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Background Audio Playback (0:24 to 0:55 Loop)
  useEffect(() => {
    const audio = new Audio("/Just-You-and-I.flac");
    audio.preload = "auto";
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      if (audio.currentTime >= AUDIO_END_TIME) {
        audio.currentTime = AUDIO_START_TIME;
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);

    // Play on first user click or tap anywhere on page
    const handleUserGesture = () => {
      if (audio.paused) {
        audio.currentTime = AUDIO_START_TIME;
        audio.play()
          .then(() => setIsPlayingAudio(true))
          .catch(() => setIsPlayingAudio(false));
      }
      window.removeEventListener("click", handleUserGesture);
      window.removeEventListener("touchstart", handleUserGesture);
    };

    window.addEventListener("click", handleUserGesture);
    window.addEventListener("touchstart", handleUserGesture);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      window.removeEventListener("click", handleUserGesture);
      window.removeEventListener("touchstart", handleUserGesture);
      audio.pause();
    };
  }, []);

  const toggleAudio = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      audioRef.current.currentTime = AUDIO_START_TIME;
      audioRef.current.play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => {});
    }
  };

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    setSubscribed(true);
    setEmailInput("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#0c0c0e] text-[#f4f4f5] font-sans selection:bg-[#ff2d46] selection:text-white relative">
      {/* Top Navbar */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 md:px-12 flex items-center justify-between z-30 border-b border-[#1f1f23] bg-[#0c0c0e]/90 backdrop-blur-md sticky top-0">
        <div className="flex items-center gap-4">
          <Logo size="sm" />
        </div>

        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-medium text-zinc-400">
          <Link href="#features" className="hidden sm:inline-block hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#about" className="hidden sm:inline-block hover:text-white transition-colors">
            What is this?
          </Link>
          <Link href="#preview" className="hidden md:inline-flex items-center gap-1.5 hover:text-white transition-colors">
            <span>Live Relay</span>
            <span className="bg-[#ff2d46]/20 border border-[#ff2d46]/40 text-[#ff2d46] text-[9px] font-bold tracking-wide uppercase px-1.5 py-0.2 rounded">
              LIVE
            </span>
          </Link>
          
          {isLoggedIn ? (
            <Link 
              href="/dashboard" 
              className="bg-[#ff2d46] hover:bg-[#e11d48] text-white px-5 py-2 rounded-full font-bold transition-all text-xs sm:text-sm shadow-md shadow-red-950/50"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="hover:text-white transition-colors px-2 py-1">
                Login
              </Link>
              <Link 
                href="/register" 
                className="bg-[#ff2d46] hover:bg-[#e11d48] text-white px-4 py-1.5 sm:px-5 sm:py-2 rounded-full font-bold transition-all text-xs sm:text-sm shadow-md shadow-red-950/50"
              >
                Get Started
              </Link>
            </>
          )}
          
          <a 
            href="https://github.com" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="text-zinc-400 hover:text-white transition-colors p-1"
            title="View Source on GitHub"
          >
            <Github size={18} />
          </a>
        </nav>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 md:py-20 z-10">
        {/* Hero Section */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 items-center mb-16 sm:mb-24">
          <div className="lg:col-span-8 flex flex-col items-center lg:items-start text-center lg:text-left">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.12]">
              <span className="block mb-1">
                <span className="text-[#ff2d46]">Listen</span>
                <span className="text-white">In</span>
              </span>
              Enjoy your music together with friends
            </h1>

            <p className="text-zinc-400 text-sm sm:text-lg md:text-xl font-normal mt-4 mb-6 sm:mb-8 max-w-xl">
              Beautiful and fast music broadcasting server.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-center lg:justify-start">
              <Link 
                href={isLoggedIn ? "/dashboard" : "/register"} 
                className="w-full sm:w-auto bg-[#ff2d46] hover:bg-[#e11d48] text-white px-7 py-3 rounded-full font-bold text-sm sm:text-base text-center transition-all shadow-lg shadow-red-950/60"
              >
                {isLoggedIn ? "Go to Dashboard" : "Start Party"}
              </Link>
              {!isLoggedIn && (
                <Link 
                  href="/login" 
                  className="w-full sm:w-auto bg-white hover:bg-zinc-200 text-black px-7 py-3 rounded-full font-bold text-sm sm:text-base text-center transition-all"
                >
                  Join Room
                </Link>
              )}
            </div>
          </div>

          {/* Right Side: Actual Logo Illustration */}
          <div className="lg:col-span-4 flex justify-center lg:justify-end mt-4 lg:mt-0">
            <div className="w-40 h-40 sm:w-56 sm:h-56 rounded-full bg-white flex items-center justify-center shadow-2xl shadow-red-950/30 border-4 border-white relative overflow-hidden group hover:scale-105 transition-transform duration-300">
              <div className="w-24 h-24 sm:w-36 sm:h-36 rounded-full bg-[#0c0c0e] flex items-center justify-center p-3 sm:p-4">
                <LogoIcon className="w-16 h-16 sm:w-24 sm:h-24 text-[#ff2d46]" />
              </div>
            </div>
          </div>
        </section>

        {/* Video / Room UI Preview Container */}
        <section id="preview" className="w-full mb-16 sm:mb-24">
          <div className="bg-[#141417] border border-[#27272a] rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="bg-[#1c1c20] px-4 py-2.5 border-b border-[#27272a] flex items-center justify-between text-xs text-zinc-400">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#ff2d46] animate-ping"></span>
                <span className="text-white font-medium text-[11px] sm:text-xs">Live Broadcast Room Preview</span>
              </div>
              <div className="flex items-center gap-3 sm:gap-4 font-mono text-[10px] sm:text-[11px]">
                <span>128 kbps WebRTC</span>
                <span className="text-[#ff2d46] font-semibold">Near-Zero Latency</span>
              </div>
            </div>

            <div className="p-6 sm:p-12 text-center flex flex-col items-center justify-center min-h-[240px]">
              {/* Interactive Sound Wave Toggle Button */}
              <button
                onClick={toggleAudio}
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-[#ff2d46]/10 border border-[#ff2d46]/30 text-[#ff2d46] hover:bg-[#ff2d46] hover:text-white flex items-center justify-center mb-3 sm:mb-4 transition-all duration-300 shadow-lg shadow-red-950/40 cursor-pointer group hover:scale-110 active:scale-95"
                title={isPlayingAudio ? "Click to Pause Audio" : "Click to Play Audio"}
              >
                {isPlayingAudio ? (
                  <Volume2 size={28} className="sm:w-8 sm:h-8 animate-pulse" />
                ) : (
                  <VolumeX size={28} className="sm:w-8 sm:h-8" />
                )}
              </button>

              <h3 className="text-xl sm:text-3xl font-bold text-white mb-2 tracking-tight">Synchronized Audio Stream</h3>
              <p className="text-zinc-400 text-xs sm:text-sm max-w-md mb-5 sm:mb-6 leading-relaxed">
                Host shares browser tab audio or system playback. Connected friends listen live in 100% sync.
              </p>
              <Link
                href="/register"
                className="bg-[#ff2d46] text-white px-5 py-2.5 rounded-full text-xs sm:text-sm font-bold hover:bg-[#e11d48] transition-colors shadow-md w-full sm:w-auto"
              >
                Create Room Now
              </Link>
            </div>
          </div>
        </section>

        {/* What is this? Section */}
        <section id="about" className="w-full mb-16 sm:mb-24 max-w-4xl">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            What is this?
          </h2>
          <p className="text-zinc-300 text-base sm:text-xl md:text-2xl font-normal leading-relaxed">
            <span className="text-[#ff2d46] font-bold">Listen</span><span className="text-white font-bold">In</span> is a beautifully designed, real-time synchronized audio streaming server. Like a cooler Spotify ... but bring your own audio.
          </p>
        </section>

        {/* Features Section */}
        <section id="features" className="w-full mb-16 sm:mb-24">
          <h2 className="text-2xl sm:text-4xl md:text-5xl font-bold text-white tracking-tight mb-2">
            Features
          </h2>
          <p className="text-zinc-400 text-xs sm:text-sm md:text-base font-normal mb-6 sm:mb-8">
            Here are some cool features offered by ListenIn
          </p>

          <div className="space-y-4 sm:space-y-6">
            {/* Row 1: 2 Equal Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden min-h-[160px] sm:min-h-[190px] transition-colors">
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46]">
                    <Sparkles size={18} className="sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-white tracking-tight mb-1">Clean and sleek UI</h3>
                  <p className="text-zinc-400 text-xs sm:text-sm font-normal leading-relaxed">
                    The cleanest and most streamlined user interface you'll ever need for your audio listening server.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col justify-between relative overflow-hidden min-h-[160px] sm:min-h-[190px] transition-colors">
                <div className="flex justify-between items-start mb-4 sm:mb-6">
                  <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46]">
                    <Radio size={18} className="sm:w-5 sm:h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-base sm:text-xl font-bold text-white tracking-tight mb-1">WebRTC Audio Relay</h3>
                  <p className="text-zinc-400 text-xs sm:text-sm font-normal leading-relaxed">
                    Stream browser tab or media playback to room members with near-zero latency in perfect synchronization.
                  </p>
                </div>
              </div>
            </div>

            {/* Row 2: 1 Full Wide Card */}
            <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-6 transition-colors">
              <div className="max-w-xl">
                <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46] inline-block mb-3 sm:mb-4">
                  <Users size={18} className="sm:w-5 sm:h-5" />
                </div>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-tight mb-1">Real-time Presence & Synchronized Chat</h3>
                <p className="text-zinc-400 text-xs sm:text-sm font-normal leading-relaxed">
                  Track online active room members live. Share messages, reactions, and keep everyone connected in the room.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="bg-[#ff2d46]/20 border border-[#ff2d46]/40 text-[#ff2d46] text-[9px] sm:text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
                  LIVE SYNC
                </span>
              </div>
            </div>

            {/* Row 3: 3 Column Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
              {/* Card 1 */}
              <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col justify-between min-h-[150px] sm:min-h-[180px] transition-colors">
                <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46] w-fit mb-3 sm:mb-4">
                  <BarChart3 size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mb-1">Active Presences</h3>
                  <p className="text-zinc-400 text-xs font-normal leading-relaxed">
                    See exactly who is online and listening live in your room at any given moment.
                  </p>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col justify-between min-h-[150px] sm:min-h-[180px] transition-colors">
                <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46] w-fit mb-3 sm:mb-4">
                  <ShieldCheck size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mb-1">Private Invite Codes</h3>
                  <p className="text-zinc-400 text-xs font-normal leading-relaxed">
                    Host private listening sessions for your squad with secure 6-character room codes.
                  </p>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-[#141417] border border-[#27272a] hover:border-zinc-700 rounded-2xl p-5 sm:p-7 flex flex-col justify-between min-h-[150px] sm:min-h-[180px] transition-colors">
                <div className="p-2.5 sm:p-3 bg-[#1e1e24] border border-[#2d2d35] rounded-xl text-[#ff2d46] w-fit mb-4">
                  <Volume2 size={18} className="sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-white tracking-tight mb-1">Bring Your Own Audio</h3>
                  <p className="text-zinc-400 text-xs font-normal leading-relaxed">
                    Broadcast anything playing in your browser or desktop app — Spotify, YouTube, or local files.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Bottom Action CTA Button */}
        <section className="flex justify-center mb-16">
          <Link
            href="/register"
            className="bg-[#ff2d46] hover:bg-[#e11d48] text-white px-8 py-3 rounded-full font-bold text-sm sm:text-base tracking-wide transition-all shadow-lg shadow-red-950/50 w-full sm:w-auto text-center"
          >
            Start Listening Party
          </Link>
        </section>

        {/* Newsletter Box */}
        <section className="w-full max-w-2xl mx-auto mb-16 sm:mb-20">
          <div className="bg-[#141417] border border-[#27272a] rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden">
            <h3 className="text-2xl sm:text-4xl font-bold text-white mb-2 tracking-tight">Join our Newsletter</h3>
            <p className="text-zinc-400 text-xs sm:text-sm mb-6 font-normal">
              Get the latest news and useful updates from our team. No spam.
            </p>

            {subscribed ? (
              <div className="bg-[#10b981]/20 border border-[#10b981]/40 text-[#10b981] p-3 rounded-xl text-xs sm:text-sm font-semibold">
                Thanks for subscribing! We'll keep you updated.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="flex-1 bg-[#27272a] border border-[#3f3f46] text-white text-xs sm:text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-[#ff2d46]"
                />
                <button
                  type="submit"
                  className="bg-[#ff2d46] hover:bg-[#e11d48] text-white font-bold text-xs sm:text-sm px-6 py-3 rounded-xl transition-colors shrink-0 shadow-md w-full sm:w-auto"
                >
                  Sign me up!
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1f1f23] py-6 sm:py-8 px-4 text-center text-xs text-zinc-500 bg-[#0c0c0e]">
        <p className="mb-1">A labor of love built for music lovers</p>
        <p>© 2026 <span className="text-[#ff2d46] font-bold">Listen</span><span className="text-white font-bold">In</span></p>
      </footer>
    </div>
  );
}
