import { z } from 'zod';

export const zTranslatable = z.object({
  en: z.string(),
  vi: z.string(),
});

export const zObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid ObjectId');
