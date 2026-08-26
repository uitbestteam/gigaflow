import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error.js';
import { internalAuth } from './middleware/internal-auth.js';
import { health } from './modules/health/health.routes.js';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', logger());
  app.route('/health', health);
  app.use('/internal/*', internalAuth());
  app.get('/internal/tasks/ping', (c) => c.json({ success: true, data: { pong: true } }));
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
