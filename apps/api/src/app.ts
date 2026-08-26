import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error';
import { health } from './modules/health/health.routes';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', logger());
  app.route('/health', health);
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
