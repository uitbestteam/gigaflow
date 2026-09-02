import { z } from 'zod';
import { SessionStatus } from '../enums/index.js';
import { zExerciseSlot } from './plan.js';

const zPerfSet = z.object({
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  rir: z.number().int().min(0).max(10).optional(),
});

export const zSetLog = z.object({
  id: z.string(),
  sessionId: z.string(),
  slotId: z.string(),
  exerciseId: z.string(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  isCompleted: z.boolean(),
  loggedAt: z.coerce.date(),
});

export const zLogSetInput = z.object({
  slotId: z.string(),
  exerciseId: z.string(),
  setNumber: z.number().int().min(1),
  weightKg: z.number().min(0),
  repsDone: z.number().int().min(0),
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(0),
  restSeconds: z.number().int().min(0).optional(),
  rir: z.number().int().min(0).max(10).optional(),
  isCompleted: z.boolean(),
});

export const zTrainingSession = z.object({
  id: z.string(),
  userId: z.string(),
  templateId: z.string(),
  sessionNumber: z.number().int().min(1),
  startedAt: z.coerce.date(),
  finishedAt: z.coerce.date().optional(),
  status: z.nativeEnum(SessionStatus),
  pausedDurationSeconds: z.number().int().min(0).optional(),
  totalVolume: z.number().min(0).optional(),
  totalSets: z.number().int().min(0).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

export const zExercisePerformance = z.object({
  id: z.string(),
  userId: z.string(),
  exerciseId: z.string(),
  lastSets: z.array(zPerfSet),
  lastPerformedAt: z.coerce.date(),
  bestSet: z.object({ weightKg: z.number().min(0), repsDone: z.number().int().min(0), e1RM: z.number().min(0) }),
  totalVolume: z.number().min(0),
  totalSessions: z.number().int().min(0),
});

export const zSlotTarget = zExerciseSlot.extend({
  weightSuggested: z.number().min(0),
  repsSuggested: z.number().int().min(1),
  lastSets: z.array(zPerfSet).optional(),
});

export const zSessionStartResult = z.object({
  session: zTrainingSession,
  slots: z.array(zSlotTarget),
});

export type PerfSet = z.infer<typeof zPerfSet>;
export type SetLog = z.infer<typeof zSetLog>;
export type LogSetInput = z.infer<typeof zLogSetInput>;
export type TrainingSession = z.infer<typeof zTrainingSession>;
export type ExercisePerformance = z.infer<typeof zExercisePerformance>;
export type SlotTarget = z.infer<typeof zSlotTarget>;
export type SessionStartResult = z.infer<typeof zSessionStartResult>;
