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
