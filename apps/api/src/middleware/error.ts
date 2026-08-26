import type { Context } from 'hono';
import type { ApiResponse } from '@gigaflow/shared';

export function errorBody(message: string): ApiResponse<never> {
  return { success: false, message };
}

export function onError(err: Error, c: Context): Response {
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  return c.json(errorBody(message), status as 500);
}

export function notFound(c: Context): Response {
  return c.json(errorBody('Not found'), 404);
}
