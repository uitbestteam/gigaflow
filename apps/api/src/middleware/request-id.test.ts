import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requestId } from './request-id';

function appWith(): Hono {
  const app = new Hono();
  app.use('*', requestId());
  app.get('/ping', (c) => c.json({ requestId: c.get('requestId') }));
  return app;
}

describe('requestId', () => {
  it('generates and sets X-Request-Id when none is provided', async () => {
    const res = await appWith().request('/ping');
    const headerId = res.headers.get('X-Request-Id');
    expect(headerId).toBeTruthy();
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toBe(headerId);
  });

  it('echoes back an incoming X-Request-Id', async () => {
    const res = await appWith().request('/ping', {
      headers: { 'X-Request-Id': 'my-fixed-id' },
    });
    expect(res.headers.get('X-Request-Id')).toBe('my-fixed-id');
    const body = (await res.json()) as { requestId: string };
    expect(body.requestId).toBe('my-fixed-id');
  });
});
