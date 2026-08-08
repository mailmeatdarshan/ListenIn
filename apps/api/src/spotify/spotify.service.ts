import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

export interface SpotifyTrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  spotifyUrl: string;
  durationMs: number;
}

@Injectable()
export class SpotifyService {
  private readonly logger = new Logger(SpotifyService.name);
  private spotifyClientToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor(private readonly prisma: PrismaService) {}

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
      // Fallback: If no Spotify Client ID is configured in .env, we use public search resolver
      return '';
    }

    try {
      const authHeader = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const res = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });

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
   * Search tracks on Spotify (or fallback public catalog)
   */
  async searchTracks(query: string): Promise<SpotifyTrackResult[]> {
    if (!query || query.trim().length === 0) return [];

    const token = await this.getClientToken();

    if (token) {
      try {
        const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=15`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          return (data.tracks?.items || []).map((item: any) => ({
            id: item.id,
            title: item.name,
            artist: item.artists.map((a: any) => a.name).join(', '),
            album: item.album.name,
            coverUrl: item.album.images[0]?.url || '',
            spotifyUrl: item.external_urls?.spotify || '',
            durationMs: item.duration_ms,
          }));
        }
      } catch (err: any) {
        this.logger.warn(`Spotify API search failed: ${err.message}`);
      }
    }

    // Fallback search via Saavn / Public API
    try {
      const saavnRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=15`);
      if (saavnRes.ok) {
        const saavnData = (await saavnRes.json()) as any;
        const results = saavnData.data?.results || saavnData.results || [];
        return results.map((item: any) => ({
          id: item.id || String(Math.random()),
          title: item.name || item.title || 'Unknown Title',
          artist: (item.artists?.primary?.map((a: any) => a.name) || [item.primaryArtists || 'Unknown Artist']).join(', '),
          album: item.album?.name || 'Single',
          coverUrl: item.image?.[2]?.url || item.image?.[0]?.url || '',
          spotifyUrl: '',
          durationMs: (item.duration || 180) * 1000,
        }));
      }
    } catch (e: any) {
      this.logger.error(`Fallback search error: ${e.message}`);
    }

    return [];
  }

  /**
   * Resolves track metadata (Title & Artist) into a 320kbps direct playable stream URL.
   */
  async resolveAudioStream(title: string, artist: string): Promise<string> {
    try {
      const searchQuery = `${title} ${artist}`;
      const res = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(searchQuery)}&limit=1`);
      
      if (res.ok) {
        const data = (await res.json()) as any;
        const firstMatch = (data.data?.results || data.results)?.[0];
        
        if (firstMatch) {
          // Download URLs array sorted by quality (320kbps is index 4 or last item)
          const downloadUrls = firstMatch.downloadUrl;
          if (Array.isArray(downloadUrls) && downloadUrls.length > 0) {
            const bestQuality = downloadUrls[downloadUrls.length - 1]?.url || downloadUrls[0]?.url;
            if (bestQuality) return bestQuality;
          }
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to resolve audio stream for ${title}: ${err.message}`);
    }

    // Return empty fallback if resolution fails
    return '';
  }

  /**
   * Parse Spotify Link (Track or Playlist) and return track details
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
            return [{
              id: item.id,
              title: item.name,
              artist: item.artists.map((a: any) => a.name).join(', '),
              album: item.album.name,
              coverUrl: item.album.images[0]?.url || '',
              spotifyUrl: item.external_urls?.spotify || spotifyUrl,
              durationMs: item.duration_ms,
            }];
          }
        } catch (e) {}
      }
    }

    // Fallback: If URL is not direct track or token unavailable, search the text query
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
