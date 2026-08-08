import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { RoomVisibility } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsEnum(RoomVisibility)
  visibility?: RoomVisibility;
}
