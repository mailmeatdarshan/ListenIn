import { z } from 'zod';

// ─── Auth DTOs ────────────────────────────────────────

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export type RegisterDto = z.infer<typeof RegisterSchema>;

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginDto = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;

// ─── Room DTOs ────────────────────────────────────────

export const CreateRoomSchema = z.object({
  name: z
    .string()
    .min(1, 'Room name is required')
    .max(50, 'Room name must be at most 50 characters'),
  visibility: z.enum(['PRIVATE', 'PUBLIC']).default('PRIVATE'),
});

export type CreateRoomDto = z.infer<typeof CreateRoomSchema>;

export const JoinRoomSchema = z.object({
  inviteCode: z
    .string()
    .min(1, 'Invite code is required'),
});

export type JoinRoomDto = z.infer<typeof JoinRoomSchema>;

// ─── Chat DTOs ────────────────────────────────────────

export const SendMessageSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message too long'),
});

export type SendMessageDto = z.infer<typeof SendMessageSchema>;

// ─── Queue DTOs ───────────────────────────────────────

export const SuggestTrackSchema = z.object({
  roomId: z.string().uuid('Invalid room ID'),
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long'),
  sourceUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export type SuggestTrackDto = z.infer<typeof SuggestTrackSchema>;

// ─── User DTOs ────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens')
    .optional(),
  avatarUrl: z.string().url('Invalid URL').optional().or(z.literal('')),
});

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;
