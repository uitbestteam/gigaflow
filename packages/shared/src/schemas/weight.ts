import { z } from 'zod';

export const zLogWeightInput = z.object({
  weightKg: z.number().gt(0),
  loggedAt: z.coerce.date().optional(),
});

export const zWeightLog = z.object({
  id: z.string(),
  userId: z.string(),
  weightKg: z.number().gt(0),
  loggedAt: z.coerce.date(),
  createdAt: z.coerce.date(),
});

export type LogWeightInput = z.infer<typeof zLogWeightInput>;
export type WeightLog = z.infer<typeof zWeightLog>;
