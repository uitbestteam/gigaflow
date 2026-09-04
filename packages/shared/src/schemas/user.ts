import { z } from 'zod';
import { AuthProvider, AuthSource, Language, Goal, ExperienceLevel, EquipmentType } from '../enums/index.js';
import { zSubscription } from './subscription.js';

/**
 * Fitness profile captured during onboarding. Optional everywhere so existing
 * users stay valid; used to personalize/pre-fill generation and to skip the
 * onboarding flow once set.
 */
export const zUserProfile = z.object({
  goal: z.nativeEnum(Goal),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  daysPerWeek: z.number().int().min(1).max(7),
  availableEquipment: z.array(z.nativeEnum(EquipmentType)).optional(),
});

export const zUser = z.object({
  authId: z.string().min(1),
  authSource: z.nativeEnum(AuthSource),
  authProvider: z.nativeEnum(AuthProvider),
  isGuest: z.boolean(),
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  timezone: z.string(),
  language: z.nativeEnum(Language),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  subscription: zSubscription.optional(),
  /** Set once the user finishes onboarding. */
  profile: zUserProfile.optional(),
  onboardedAt: z.coerce.date().optional(),
});

export type UserProfile = z.infer<typeof zUserProfile>;
export type User = z.infer<typeof zUser>;
