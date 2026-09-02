import { describe, it, expect, beforeEach } from 'vitest';
import { configureApi } from './api';
import { registerDeviceToken, deleteDeviceToken } from './api';
import { DevicePlatform } from '@gigaflow/shared';

beforeEach(() => {
  configureApi({ getToken: () => 'tok', onUnauthorized: async () => {}, baseUrl: '/api' });
});

describe('device-token api helpers', () => {
  it('registerDeviceToken posts token+platform', async () => {
    let seen: Request | undefined;
    const dt = {
      id: 'd1',
      userId: 'u1',
      token: 't1',
      platform: 'web',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => {
      seen = new Request(i, init);
      return new Response(JSON.stringify({ success: true, data: dt }), { status: 201 });
    }) as typeof fetch;
    const out = await registerDeviceToken({ token: 't1', platform: DevicePlatform.WEB }, fetchImpl);
    expect(out.token).toBe('t1');
    expect(seen?.method).toBe('POST');
    expect(new URL(seen!.url).pathname).toContain('/notifications/device-token');
  });

  it('deleteDeviceToken DELETEs the token', async () => {
    let seen: Request | undefined;
    const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => {
      seen = new Request(i, init);
      return new Response(JSON.stringify({ success: true, data: { deleted: true } }), { status: 200 });
    }) as typeof fetch;
    expect((await deleteDeviceToken('t1', fetchImpl)).deleted).toBe(true);
    expect(seen?.method).toBe('DELETE');
    expect(new URL(seen!.url).pathname).toContain('/notifications/device-token/t1');
  });
});
