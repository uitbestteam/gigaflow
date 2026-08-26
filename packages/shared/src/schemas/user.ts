import { z } from 'zod';
import { AuthProvider, AuthSource, Language } from '../enums/index.js';

export const zUser = z.object({
  authId: z.string().min(1),
  authSource: z.nativeEnum(AuthSource),
  authProvider: z.nativeEnum(AuthProvider),
  isGuest: z.boolean(),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  timezone: z.string(),
  language: z.nativeEnum(Language),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type User = z.infer<typeof zUser>;
