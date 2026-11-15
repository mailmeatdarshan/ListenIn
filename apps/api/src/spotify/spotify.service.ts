import { Injectable, Logger } from '@nestjs/common';
import * as CryptoJS from 'crypto-js';
import { PrismaService } from '../common/prisma.service';

export interface SpotifyTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  spotifyUrl: string;
  durationMs: number;
  audioUrl?: string;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private spotifyClientToken: string | null = null;
  private tokenExpiresAt: number = 0;

  // In-memory cache for ultra-fast query responses (<5ms on cache hit)
  private readonly searchCache = new Map<string, { data: SpotifyTrackResult[]; expiresAt: number }>();
  private readonly streamCache = new Map<string, { audioUrl: string; duration: number; expiresAt: number }>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decodes HTML entities in titles and artists (e.g. &amp;, &quot;, &#039;)
   */
  private decodeHtmlEntities(str: string): string {
    if (!str) return '';
    return str
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&ndash;/g, '-')
      .replace(/&mdash;/g, '—')
      .trim();
  }

  /**
   * Decrypts JioSaavn encrypted_media_url using DES-ECB with key '38346591'
   * Upgrades output stream from 96kbps to full 320kbps MP4 AAC Hi-Res audio.
   */
  private decryptSaavnUrl(encUrl: string): string {
    if (!encUrl) return '';
    try {
      const key = CryptoJS.enc.Utf8.parse('38346591');
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(encUrl),
      });
      const decrypted = CryptoJS.DES.decrypt(
        cipherParams,
        key,
        { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 },
      );
      const rawUrl = decrypted.toString(CryptoJS.enc.Utf8);
      if (!rawUrl) return '';
      // Upgrade to 320kbps MP4 AAC stream for full song Hi-Res playback
      return rawUrl.replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
    } catch (err: any) {
      this.logger.warn(`Failed to decrypt Saavn URL: ${err.message}`);
      return '';
    }
  }

  /**
   * Obtains a Spotify Client Credentials access token for public catalog searches.
   */
  private async getClientToken(): Promise<string> {
    if (this.spotifyClientToken && Date.now() < this.tokenExpiresAt - 60000) {
      return this.spotifyClientToken;
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return '';
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        throw new Error(`Spotify token error: ${res.statusText}`);
      }

      const data = (await res.json()) as any;
      this.spotifyClientToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
      return this.spotifyClientToken;
    } catch (err: any) {
      this.logger.warn(`Failed to fetch Spotify client token: ${err.message}`);
      return '';
    }
  }

  /**
   * Search tracks across JioSaavn (Primary: Full 320kbps songs + instant decryption),
   * Spotify, and iTunes.
   */
  async searchTracks(query: string): Promise<SpotifyTrackResult[]> {
    if (!query || query.trim().length === 0) return [];
    const normalizedQuery = query.toLowerCase().trim();

    // 0. Check in-memory cache
    const cached = this.searchCache.get(normalizedQuery);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // 1. Primary Engine: JioSaavn Official Engine
    // Returns full-length tracks (3-5 mins), 500x500 high-res artwork,
    // and encrypted media URLs that decrypt directly into 320kbps CDNs.
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&p=1&n=20`;

      const saavnRes = await fetch(saavnUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (saavnRes.ok) {
        const saavnData = (await saavnRes.json()) as any;
        const results = saavnData.results || [];
        if (Array.isArray(results) && results.length > 0) {
          const mapped: SpotifyTrackResult[] = results
            .map((item: any) => {
              const fullAudioUrl = this.decryptSaavnUrl(item.encrypted_media_url);
              const durationSec = parseInt(item.duration, 10) || 180;
              return {
                id: item.id || String(Math.random()),
                title: this.decodeHtmlEntities(item.song || item.title || 'Unknown Title'),
                artist: this.decodeHtmlEntities(item.primary_artists || item.singers || item.music || 'Unknown Artist'),
                album: this.decodeHtmlEntities(item.album || 'Single'),
                coverUrl: (item.image || '').replace('150x150', '500x500'),
                spotifyUrl: item.perma_url || '',
                durationMs: durationSec * 1000,
                audioUrl: fullAudioUrl,
              };
            })
            .filter((t) => t.title && t.durationMs > 0);

          if (mapped.length > 0) {
            // Cache results for 1 hour
            this.searchCache.set(normalizedQuery, {
              data: mapped,
              expiresAt: Date.now() + 3600 * 1000,
            });

            // Also seed streamCache for each track so instant resolution succeeds
            for (const t of mapped) {
              if (t.audioUrl) {
                const streamKey = `${t.title.toLowerCase().trim()}:${t.artist.toLowerCase().trim()}`;
                this.streamCache.set(streamKey, {
                  audioUrl: t.audioUrl,
                  duration: Math.round(t.durationMs / 1000),
                  expiresAt: Date.now() + 3600 * 1000,
                });
              }
            }

            return mapped;
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`JioSaavn search failed or timed out: ${e.message}`);
    }

    // 2. Secondary Engine: Spotify API (if client credentials configured)
    const token = await this.getClientToken();
    if (token) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = (await res.json()) as any;
          const tracks = (data.tracks?.items || []).map((item: any) => ({
            id: item.id,
            title: item.name,
            artist: item.artists.map((a: any) => a.name).join(', '),
            album: item.album.name,
            coverUrl: item.album.images[0]?.url || '',
            spotifyUrl: item.external_urls?.spotify || '',
            durationMs: item.duration_ms,
          }));
          if (tracks.length > 0) {
            this.searchCache.set(normalizedQuery, {
              data: tracks,
              expiresAt: Date.now() + 3600 * 1000,
            });
            return tracks;
          }
        }
      } catch (err: any) {
        this.logger.warn(`Spotify API search failed: ${err.message}`);
      }
    }

    // 3. Fallback: iTunes Search API
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&media=music&limit=15`;
      const res = await fetch(itunesUrl);
      if (res.ok) {
        const data = (await res.json()) as any;
        if (Array.isArray(data.results) && data.results.length > 0) {
          const tracks = data.results.map((item: any) => ({
            id: String(item.trackId || Math.random()),
            title: item.trackName || item.collectionName || 'Unknown Track',
            artist: item.artistName || 'Unknown Artist',
            album: item.collectionName || 'Single',
            coverUrl: (item.artworkUrl100 || item.artworkUrl60 || '').replace('100x100bb', '600x600bb'),
            spotifyUrl: item.trackViewUrl || '',
            durationMs: item.trackTimeMillis || 180000,
            audioUrl: item.previewUrl || '',
          }));
          return tracks;
        }
      }
    } catch (e: any) {
      this.logger.warn(`iTunes API search fallback failed: ${e.message}`);
    }

    return [];
  }

  /**
   * Resolves track metadata into a direct playable audio stream URL.
   */
  async resolveAudioStream(title: string, artist: string): Promise<string> {
    const res = await this.resolveAudioStreamWithDetails(title, artist);
    return res.audioUrl;
  }

  async resolveAudioStreamWithDetails(
    title: string,
    artist: string,
  ): Promise<{ audioUrl: string; duration: number }> {
    const streamKey = `${title.toLowerCase().trim()}:${artist.toLowerCase().trim()}`;

    // 0. Check cache
    const cached = this.streamCache.get(streamKey);
    if (cached && Date.now() < cached.expiresAt) {
      return { audioUrl: cached.audioUrl, duration: cached.duration };
    }

    const searchQuery = `${title} ${artist}`.trim();

    // 1. Primary: JioSaavn full-track 320kbps direct stream
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const saavnUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(searchQuery)}&_format=json&_marker=0&p=1&n=5`;
      const res = await fetch(saavnUrl, { signal: controller.signal });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as any;
        const results = data.results || [];
        for (const item of results) {
          if (item && item.encrypted_media_url) {
            const streamUrl = this.decryptSaavnUrl(item.encrypted_media_url);
            if (streamUrl) {
              const duration = parseInt(item.duration, 10) || 180;
              const result = { audioUrl: streamUrl, duration };
              this.streamCache.set(streamKey, {
                audioUrl: streamUrl,
                duration,
                expiresAt: Date.now() + 3600 * 1000,
              });
              return result;
            }
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`JioSaavn stream resolution failed for "${title}": ${err.message}`);
    }

    // 2. Secondary: Fallback to iTunes preview if track not found on JioSaavn
    try {
      const itunesUrl = `https://itunes.apple.com/search?term=${encodeURIComponent(searchQuery)}&media=music&limit=3`;
      const res = await fetch(itunesUrl);
      if (res.ok) {
        const data = (await res.json()) as any;
        const firstMatch = data.results?.[0];
        if (firstMatch && firstMatch.previewUrl) {
          const result = {
            audioUrl: firstMatch.previewUrl,
            duration: 30,
          };
          this.streamCache.set(streamKey, {
            ...result,
            expiresAt: Date.now() + 3600 * 1000,
          });
          return result;
        }
      }
    } catch (err: any) {
      this.logger.warn(`iTunes stream resolution failed for ${title}: ${err.message}`);
    }

    return { audioUrl: '', duration: 180 };
  }

  /**
   * Parse Spotify Link (Track or Playlist) and return track details with full 320kbps streams
   */
  async resolveSpotifyUrl(spotifyUrl: string): Promise<SpotifyTrackResult[]> {
    const trackMatch = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
    if (trackMatch && trackMatch[1]) {
      const trackId = trackMatch[1];
      const token = await this.getClientToken();
      if (token) {
        try {
          const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const item = (await res.json()) as any;
            const title = item.name;
            const artist = item.artists.map((a: any) => a.name).join(', ');
            const stream = await this.resolveAudioStreamWithDetails(title, artist);
            return [{
              id: item.id,
              title,
              artist,
              album: item.album.name,
              coverUrl: item.album.images[0]?.url || '',
              spotifyUrl: item.external_urls?.spotify || spotifyUrl,
              durationMs: stream.duration ? stream.duration * 1000 : item.duration_ms,
              audioUrl: stream.audioUrl,
            }];
          }
        } catch (e) {}
      }
    }

    // Fallback: search the text query
    return this.searchTracks(spotifyUrl);
  }

  /**
   * Spotify OAuth 2.0 Auth URL generator
   */
  getOAuthUrl(redirectUri: string): string {
    const clientId = process.env.SPOTIFY_CLIENT_ID || '';
    const scopes = [
      'user-read-private',
      'user-read-email',
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-library-read',
    ].join(' ');

    return `https://accounts.spotify.com/authorize?` + new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: scopes,
      redirect_uri: redirectUri,
    }).toString();
  }

  /**
   * Handle OAuth Callback and save Spotify tokens for User
   */
  async handleOAuthCallback(code: string, redirectUri: string, userId: string) {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Spotify Client ID or Secret not configured');
    }

    const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Spotify token error: ${err}`);
    }

    const data = (await res.json()) as any;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        spotifyAccessToken: data.access_token,
        spotifyRefreshToken: data.refresh_token,
      },
    });

    return { success: true };
  }
}
