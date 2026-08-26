import { z } from 'zod';
import { zTranslatable } from './schemas/common.js';

export type Translatable = z.infer<typeof zTranslatable>;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, ...(message ? { message } : {}) };
}
