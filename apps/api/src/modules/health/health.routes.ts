import { Hono } from 'hono';
import { apiSuccess } from '@gigaflow/shared';

export const health = new Hono();

health.get('/', (c) =>
  c.json(apiSuccess({ status: 'ok', uptime: process.uptime(), env: process.env.NODE_ENV ?? 'development' })),
);

health.get('/ready', (c) => c.json(apiSuccess({ ready: true })));
health.get('/live', (c) => c.json(apiSuccess({ alive: true })));
