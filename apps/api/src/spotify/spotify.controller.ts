import { Controller, Get, Post, Query, Body, UseGuards, Request, Res } from '@nestjs/common';
import { SpotifyService } from './spotify.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('spotify')
export class SpotifyController {
  constructor(private readonly spotifyService: SpotifyService) {}

  @Get('search')
  async search(@Query('q') query: string) {
    return this.spotifyService.searchTracks(query);
  }

  @Post('resolve-url')
  async resolveUrl(@Body('url') url: string) {
    return this.spotifyService.resolveSpotifyUrl(url);
  }

  @Post('resolve-stream')
  async resolveStream(@Body('title') title: string, @Body('artist') artist: string) {
    const audioUrl = await this.spotifyService.resolveAudioStream(title, artist);
    return { audioUrl };
  }

  @Post('play')
  @UseGuards(AuthGuard)
  async playTrack(
    @Body('title') title: string,
    @Body('artist') artist: string,
    @Body('coverUrl') coverUrl: string,
  ) {
    const result = await this.spotifyService.resolveAudioStreamWithDetails(title, artist || '');
    return {
      title,
      artist: artist || 'Unknown Artist',
      coverUrl: coverUrl || '',
      audioUrl: result.audioUrl,
      duration: result.duration,
    };
  }

  @Get('auth-url')
  @UseGuards(AuthGuard)
  getAuthUrl(@Query('redirectUri') redirectUri: string) {
    return { url: this.spotifyService.getOAuthUrl(redirectUri) };
  }

  @Post('callback')
  @UseGuards(AuthGuard)
  async handleCallback(
    @Request() req: any,
    @Body('code') code: string,
    @Body('redirectUri') redirectUri: string,
  ) {
    return this.spotifyService.handleOAuthCallback(code, redirectUri, req.user.id);
  }
}
