import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { RoomsService } from './rooms.service';
import { AuthGuard } from '../auth/auth.guard';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';

@Controller('rooms')
@UseGuards(AuthGuard)
export class RoomsController {
  constructor(private readonly roomsService: RoomsService) {}

  @Post()
  async createRoom(@Request() req, @Body() dto: CreateRoomDto) {
    return this.roomsService.createRoom(req.user.id, dto);
  }

  @Get()
  async getMyRooms(@Request() req) {
    return this.roomsService.getUserRooms(req.user.id);
  }

  @Get('public')
  async getPublicRooms() {
    return this.roomsService.getPublicRooms();
  }

  @Get(':id')
  async getRoom(@Request() req, @Param('id') id: string) {
    return this.roomsService.getRoomDetails(id, req.user.id);
  }

  @Post('join')
  async joinRoom(@Request() req, @Body() dto: JoinRoomDto) {
    return this.roomsService.joinRoom(req.user.id, dto.inviteCode);
  }

  @Post(':id/transfer-host')
  async transferHost(@Request() req, @Param('id') id: string, @Body() body: { newHostId: string }) {
    return this.roomsService.transferHost(id, req.user.id, body.newHostId);
  }

  @Post(':id/kick')
  async kickMember(@Request() req, @Param('id') id: string, @Body() body: { targetUserId: string }) {
    return this.roomsService.kickMember(id, req.user.id, body.targetUserId);
  }

  @Delete(':id')
  async deleteRoom(@Request() req, @Param('id') id: string) {
    return this.roomsService.deleteRoom(id, req.user.id);
  }

  @Post(':id/leave')
  async leaveRoom(@Request() req, @Param('id') id: string) {
    return this.roomsService.leaveRoom(id, req.user.id);
  }

  @Get(':id/livekit-token')
  async getLivekitToken(@Request() req, @Param('id') id: string) {
    return this.roomsService.getLivekitToken(id, req.user.id);
  }
}
