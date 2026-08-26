import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { internalAuth } from './internal-auth';

function appWith(): Hono {
  const app = new Hono();
  app.use('/internal/*', internalAuth());
  app.get('/internal/tasks/ping', (c) => c.json({ success: true }));
  return app;
}

describe('internalAuth', () => {
  it('rejects request without Cloud Tasks marker', async () => {
    const res = await appWith().request('/internal/tasks/ping');
    expect(res.status).toBe(401);
  });
  it('allows request with Cloud Tasks queue header', async () => {
    const res = await appWith().request('/internal/tasks/ping', {
      headers: { 'X-CloudTasks-QueueName': 'workout-gen' },
    });
    expect(res.status).toBe(200);
  });
});
