import { z } from 'zod';
import { EquipmentType, MuscleGroup } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zExercise = z.object({
  id: z.string(),
  slug: z.string().min(1),
  name: zTranslatable,
  muscleGroup: z.nativeEnum(MuscleGroup),
  equipmentType: z.nativeEnum(EquipmentType),
  defaultIncrement: z.number().min(0),
  videoUrl: z.string().optional(),
  isCustom: z.boolean(),
  ownerUserId: z.string().optional(),
});

export const zCreateExerciseInput = z.object({
  name: zTranslatable,
  muscleGroup: z.nativeEnum(MuscleGroup),
  equipmentType: z.nativeEnum(EquipmentType),
  defaultIncrement: z.number().min(0).optional(),
  videoUrl: z.string().optional(),
});

export type Exercise = z.infer<typeof zExercise>;
export type CreateExerciseInput = z.infer<typeof zCreateExerciseInput>;
