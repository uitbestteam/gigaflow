import { describe, it, expect } from 'vitest';
import { createApp } from '../../app';

describe('health', () => {
  it('GET /health returns ok envelope', async () => {
    const app = createApp();
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { status?: string; ready?: boolean };
      message?: string;
    };
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
  it('GET /health/ready returns ready', async () => {
    const app = createApp();
    const res = await app.request('/api/health/ready');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { status?: string; ready?: boolean };
      message?: string;
    };
    expect(body.data.ready).toBe(true);
  });
  it('unknown route returns error envelope 404', async () => {
    const app = createApp();
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    const body = (await res.json()) as {
      success: boolean;
      data?: { status?: string; ready?: boolean };
      message?: string;
    };
    expect(body.success).toBe(false);
  });
});
