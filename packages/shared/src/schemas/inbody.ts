import { z } from 'zod';
import { ImageMimeType } from '../enums/index.js';

export const zInbodyMetrics = z.object({
  weightKg: z.number().min(0),
  bmi: z.number().min(0).optional(),
  bodyFatPercent: z.number().min(0).optional(),
  skeletalMuscleMassKg: z.number().min(0).optional(),
  bodyFatMassKg: z.number().min(0).optional(),
  visceralFatLevel: z.number().min(0).optional(),
});

export const zAnalyzeInbodyInput = z.object({
  imageBase64: z.string().min(1).max(10_000_000, 'imageBase64 exceeds the 10,000,000 character limit'),
  mimeType: z.nativeEnum(ImageMimeType),
});

export const zInbodyResult = z.object({
  id: z.string(),
  userId: z.string(),
  metrics: zInbodyMetrics,
  takenAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export type InbodyMetrics = z.infer<typeof zInbodyMetrics>;
export type AnalyzeInbodyInput = z.infer<typeof zAnalyzeInbodyInput>;
export type InbodyResult = z.infer<typeof zInbodyResult>;
