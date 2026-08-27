import type { MiddlewareHandler } from 'hono';
import type { GenerationType } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { tryConsume } from './quota.service.js';

export function quotaGuard(type: GenerationType): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    const result = await tryConsume(user.authId, type, new Date());
    if (!result.allowed) {
      return c.json(errorBody('AI generation quota exceeded'), 429);
    }
    await next();
  };
}
