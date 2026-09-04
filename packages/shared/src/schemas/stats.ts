import { z } from 'zod';
import { AwardKey } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zPersonalRecord = z.object({
  exerciseId: z.string(),
  name: zTranslatable,
  bestSet: z.object({
    weightKg: z.number().min(0),
    repsDone: z.number().int().min(0),
    e1RM: z.number().min(0),
  }),
});

export const zStatsSummary = z.object({
  totalSessions: z.number().int().min(0),
  totalVolume: z.number().min(0),
  totalPrs: z.number().int().min(0),
  totalExercises: z.number().int().min(0),
  /** Consecutive calendar weeks (up to and including the current one) with ≥1 finished session. */
  currentStreakWeeks: z.number().int().min(0),
  /** Best-ever consecutive-week streak. */
  longestStreakWeeks: z.number().int().min(0),
  /** Total meal plans the user has generated (for the first-meal-plan award). */
  totalMealPlans: z.number().int().min(0),
});

/** One week's training volume split by muscle group (for the volume-trend chart). */
export const zVolumeByWeek = z.object({
  weekStart: z.coerce.date(),
  byMuscleGroup: z.record(z.string(), z.number().min(0)),
  total: z.number().min(0),
});

export const zAward = z.object({
  key: z.nativeEnum(AwardKey),
  name: zTranslatable,
  description: zTranslatable,
  target: z.number().min(0),
  current: z.number().min(0),
  earned: z.boolean(),
});

export type PersonalRecord = z.infer<typeof zPersonalRecord>;
export type StatsSummary = z.infer<typeof zStatsSummary>;
export type Award = z.infer<typeof zAward>;
export type VolumeByWeek = z.infer<typeof zVolumeByWeek>;
