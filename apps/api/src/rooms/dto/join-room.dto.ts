import { IsString, Length } from 'class-validator';

export class JoinRoomDto {
  @IsString()
  @Length(8, 8)
  inviteCode: string;
}
