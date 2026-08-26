import type { MiddlewareHandler } from 'hono';

// E1 khung: chấp nhận request mang header Cloud Tasks; prod (E7) sẽ verify OIDC token.
export function internalAuth(): MiddlewareHandler {
  return async (c, next) => {
    const marker = c.req.header('X-CloudTasks-QueueName');
    if (!marker) {
      return c.json({ success: false, message: 'Forbidden' }, 401);
    }
    await next();
  };
}
