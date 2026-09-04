import { z } from 'zod';
import { ExperienceLevel, GenerationType, Goal, JobStatus } from '../enums/index.js';
import { ColorTag, EquipmentType, InjuryArea, MuscleGroup } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zGenerateWorkoutInput = z.object({
  goal: z.nativeEnum(Goal),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  daysPerWeek: z.number().int().min(1).max(7),
  /** Equipment the user can train with; empty/omitted = assume a full gym. */
  availableEquipment: z.array(z.nativeEnum(EquipmentType)).optional(),
  /** Joints/areas to protect; the AI avoids loading these. */
  injuries: z.array(z.nativeEnum(InjuryArea)).optional(),
  /** Target time per session in minutes (caps sets/exercises). */
  sessionMinutes: z.number().int().min(20).max(120).optional(),
  /** Muscle groups to emphasize with extra volume. */
  emphasis: z.array(z.nativeEnum(MuscleGroup)).optional(),
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
