import type { MiddlewareHandler } from 'hono';
import type { GenerationType } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { checkQuota } from './quota.service.js';

export function quotaGuard(type: GenerationType): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get('user');
    const status = await checkQuota(user.authId, type, new Date());
    if (!status.allowed) {
      return c.json(errorBody('AI generation quota exceeded'), 429);
    }
    await next();
  };
}
