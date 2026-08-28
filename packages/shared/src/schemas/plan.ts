import { z } from 'zod';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zPlan = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1),
  templateType: z.nativeEnum(PlanTemplateType),
  source: z.nativeEnum(PlanSource),
  isActive: z.boolean(),
  createdAt: z.date(),
});

export const zWorkoutTemplate = z.object({
  id: z.string(),
  planId: z.string(),
  name: zTranslatable,
  focus: zTranslatable.optional(),
  orderIndex: z.number().int().min(0),
  colorTag: z.nativeEnum(ColorTag),
});

export const zExerciseSlot = z.object({
  id: z.string(),
  templateId: z.string(),
  exerciseId: z.string(),
  orderIndex: z.number().int().min(0),
  setsTarget: z.number().int().min(1).max(10),
  repRangeMin: z.number().int().min(1),
  repRangeMax: z.number().int().min(1),
  equipmentType: z.nativeEnum(EquipmentType),
  weightIncrement: z.number().min(0),
});

export const zPlanWithTemplates = zPlan.extend({
  templates: z.array(zWorkoutTemplate.extend({ slots: z.array(zExerciseSlot) })),
});

export type Plan = z.infer<typeof zPlan>;
export type WorkoutTemplate = z.infer<typeof zWorkoutTemplate>;
export type ExerciseSlot = z.infer<typeof zExerciseSlot>;
export type PlanWithTemplates = z.infer<typeof zPlanWithTemplates>;

// Input schemas for create/update (server-assigned ids omitted; the graph is authoritative on save).
export const zSlotInput = z.object({
  exerciseId: z.string().min(1),
  orderIndex: z.number().int().min(0),
  setsTarget: z.number().int().min(1).max(10),
  repRangeMin: z.number().int().min(1),
  repRangeMax: z.number().int().min(1),
  equipmentType: z.nativeEnum(EquipmentType),
  weightIncrement: z.number().min(0),
});
export const zTemplateInput = z.object({
  name: zTranslatable,
  focus: zTranslatable.optional(),
  orderIndex: z.number().int().min(0),
  colorTag: z.nativeEnum(ColorTag),
  slots: z.array(zSlotInput),
});
export const zCreatePlanInput = z.object({
  name: z.string().min(1),
  templateType: z.nativeEnum(PlanTemplateType),   // CUSTOM for hand-built
  isActive: z.boolean().optional(),               // default false; server activates via /activate too
  templates: z.array(zTemplateInput).min(1),
});
export const zUpdatePlanInput = zCreatePlanInput;  // same shape; replaces the graph
export type CreatePlanInput = z.infer<typeof zCreatePlanInput>;
export type UpdatePlanInput = z.infer<typeof zUpdatePlanInput>;
