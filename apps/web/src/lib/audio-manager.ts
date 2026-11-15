/**
 * AudioManager - High-precision web audio manager inspired by BeatSync.
 * Handles iOS silent-switch bypass, auto-unlock on user gesture,
 * screen wake-lock to prevent WiFi Power-Save Mode, and multi-device sync.
 */

// Minimal silent WAV (1 sample, 44.1kHz, 16-bit mono, 46 bytes).
// Forces iOS onto media channel so audio plays through speakers even if hardware mute is on.
const SILENCE_DATA_URL =
  "data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQIAAAAAAA==";

export interface TrackPlaybackData {
  audioUrl: string;
  startedAt: number;
  isPlaying: boolean;
  seekPosition?: number;
  duration?: number;
}

class AudioManager {
  private static instance: AudioManager | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private silentAudioEl: HTMLAudioElement | null = null;
  private isUnlocked = false;
  private hasGestureListeners = false;
  private wakeLock: any = null;
  private currentTrackUrl: string = "";

  private constructor() {
    if (typeof window !== "undefined") {
      this.init();
    }
  }

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private isIOS(): boolean {
    if (typeof window === "undefined") return false;
    const ua = navigator.userAgent.toLowerCase();
    return (
      ua.includes("iphone") ||
      ua.includes("ipad") ||
      ua.includes("ipod") ||
      (ua.includes("mac os x") && navigator.maxTouchPoints > 0)
    );
  }

  private init() {
    if (typeof document === "undefined") return;

    // 1. Create or retrieve main playback audio element
    let el = document.getElementById("listenin-synced-audio") as HTMLAudioElement;
    if (!el) {
      el = document.createElement("audio");
      el.id = "listenin-synced-audio";
      el.preload = "auto";
      el.autoplay = true;
      (el as any).playsInline = true;
      el.muted = false;
      el.style.display = "none";
      document.body.appendChild(el);
    }
    this.audioEl = el;

    // 2. Setup iOS silent mode bypass & gesture unlockers
    this.registerGestureUnlockers();
  }

  /**
   * Register capture-phase listeners on window to unlock audio on first touch
   * before React synthetic events fire.
   */
  private registerGestureUnlockers() {
    if (this.hasGestureListeners || typeof window === "undefined") return;
    this.hasGestureListeners = true;

    const events = ["click", "touchstart", "touchend", "keydown"];

    const onUserGesture = () => {
      this.unlockAudio();
      // Remove listeners once successfully unlocked
      if (this.isUnlocked) {
        for (const evt of events) {
          window.removeEventListener(evt, onUserGesture, true);
        }
      }
    };

    for (const evt of events) {
      window.addEventListener(evt, onUserGesture, { capture: true, passive: true });
    }
  }

  /**
   * Unlocks both the main audio element and plays silent audio for iOS mute-switch bypass.
   */
  public unlockAudio(): Promise<boolean> {
    if (this.isUnlocked) return Promise.resolve(true);

    const promises: Promise<any>[] = [];

    // 1. Unlock main element
    if (this.audioEl) {
      this.audioEl.muted = false;
      (this.audioEl as any).playsInline = true;
      if (this.audioEl.src && this.audioEl.paused) {
        promises.push(
          this.audioEl.play().catch(() => {})
        );
      }
    }

    // 2. iOS Silent Mode bypass (Media channel allocation)
    if (this.isIOS() && !this.silentAudioEl && typeof document !== "undefined") {
      const silent = document.createElement("audio");
      silent.setAttribute("x-webkit-airplay", "deny");
      silent.controls = false;
      (silent as any).disableRemotePlayback = true;
      silent.preload = "auto";
      silent.loop = true;
      silent.src = SILENCE_DATA_URL;
      silent.style.display = "none";
      document.body.appendChild(silent);

      const p = silent.play();
      if (p) {
        p.then(() => {
          this.silentAudioEl = silent;
          this.isUnlocked = true;
        }).catch(() => {});
      }
    } else {
      this.isUnlocked = true;
    }

    // 3. Request WakeLock to prevent mobile WiFi Power-Save Mode
    this.requestWakeLock();

    return Promise.all(promises)
      .then(() => {
        this.isUnlocked = true;
        return true;
      })
      .catch(() => false);
  }

  /**
   * Synchronized track playback across devices.
   */
  public playTrack(data: TrackPlaybackData) {
    if (!this.audioEl) this.init();
    const el = this.audioEl;
    if (!el || !data.audioUrl) return;

    // If new track URL
    if (this.currentTrackUrl !== data.audioUrl || el.src !== data.audioUrl) {
      this.currentTrackUrl = data.audioUrl;
      el.src = data.audioUrl;
      el.load();
    }

    if (data.isPlaying) {
      const elapsed = Math.max(0, (Date.now() - data.startedAt) / 1000);
      const targetTime = (data.seekPosition !== undefined && data.seekPosition > 0)
        ? data.seekPosition
        : elapsed;

      // Sync seek time if drift > 0.4s
      if (Math.abs(el.currentTime - targetTime) > 0.4) {
        el.currentTime = targetTime;
      }

      el.muted = false;
      (el as any).playsInline = true;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn("[AudioManager] Autoplay blocked, awaiting user gesture:", err);
          this.isUnlocked = false;
        });
      }

      this.requestWakeLock();
    } else {
      el.pause();
      if (data.seekPosition !== undefined) {
        el.currentTime = data.seekPosition;
      }
    }
  }

  public pause(currentTime?: number) {
    if (!this.audioEl) return;
    this.audioEl.pause();
    if (currentTime !== undefined) {
      this.audioEl.currentTime = currentTime;
    }
  }

  public resume(currentTime?: number, startedAt?: number) {
    if (!this.audioEl) return;
    if (currentTime !== undefined) {
      this.audioEl.currentTime = currentTime;
    } else if (startedAt) {
      this.audioEl.currentTime = Math.max(0, (Date.now() - startedAt) / 1000);
    }
    this.audioEl.play().catch(() => {
      this.unlockAudio();
    });
    this.requestWakeLock();
  }

  public seek(targetSeconds: number) {
    if (!this.audioEl) return;
    this.audioEl.currentTime = targetSeconds;
  }

  public setVolume(vol: number) {
    if (!this.audioEl) return;
    this.audioEl.volume = Math.max(0, Math.min(1, vol));
  }

  public setMuted(muted: boolean) {
    if (!this.audioEl) return;
    this.audioEl.muted = muted;
  }

  public getCurrentTime(): number {
    return this.audioEl?.currentTime || 0;
  }

  public getAudioElement(): HTMLAudioElement | null {
    if (!this.audioEl) this.init();
    return this.audioEl;
  }

  private async requestWakeLock() {
    if (this.wakeLock || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    try {
      this.wakeLock = await (navigator as any).wakeLock.request("screen");
      this.wakeLock.addEventListener("release", () => {
        this.wakeLock = null;
      });
    } catch {
      // Best-effort
    }
  }

  public cleanup() {
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = "";
    }
    if (this.silentAudioEl) {
      this.silentAudioEl.pause();
      this.silentAudioEl.src = "";
      this.silentAudioEl.remove();
      this.silentAudioEl = null;
    }
    if (this.wakeLock) {
      this.wakeLock.release().catch(() => {});
      this.wakeLock = null;
    }
  }
}

export const audioManager = AudioManager.getInstance();
