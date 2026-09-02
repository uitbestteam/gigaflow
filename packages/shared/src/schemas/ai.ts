import { z } from 'zod';
import { ExperienceLevel, GenerationType, Goal, JobStatus } from '../enums/index.js';
import { ColorTag } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zGenerateWorkoutInput = z.object({
  goal: z.nativeEnum(Goal),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  daysPerWeek: z.number().int().min(1).max(7),
});

export const zGeneratedPlan = z.object({
  name: z.string().min(1),
  templates: z
    .array(
      z.object({
        name: zTranslatable,
        colorTag: z.nativeEnum(ColorTag),
        slots: z
          .array(
            z.object({
              exerciseSlug: z.string().min(1),
              setsTarget: z.number().int().min(1).max(10),
              repRangeMin: z.number().int().min(1),
              repRangeMax: z.number().int().min(1),
            }),
          )
          .min(1),
      }),
    )
    .min(1),
});

export const zGenerationJob = z.object({
  id: z.string(),
  userId: z.string(),
  type: z.nativeEnum(GenerationType),
  status: z.nativeEnum(JobStatus),
  input: z.unknown().optional(),
  resultId: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export type GenerateWorkoutInput = z.infer<typeof zGenerateWorkoutInput>;
export type GeneratedPlan = z.infer<typeof zGeneratedPlan>;
export type GenerationJob = z.infer<typeof zGenerationJob>;
