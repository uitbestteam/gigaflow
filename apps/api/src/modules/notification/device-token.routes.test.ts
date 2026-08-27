import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import { ensureDeviceTokenIndexes } from './device-token.repo.js';
import { makeDeviceTokenRoutes } from './device-token.routes.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_device_token_routes_test');
  await ensureDeviceTokenIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

function makeApp() {
  return makeDeviceTokenRoutes({ verify });
}

describe('device-token routes', () => {
  it('401 without token', async () => {
    const res = await makeApp().request('/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'tok-1' }),
    });
    expect(res.status).toBe(401);
  });

  it('POST /device-token → 201 + DeviceToken', async () => {
    const app = makeApp();
    const res = await app.request('/device-token', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ token: 'tok-route-1', platform: 'ios' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string; userId: string; token: string } };
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('u1');
    expect(body.data.token).toBe('tok-route-1');
  });

  it('POST /device-token → 400 on invalid body', async () => {
    const res = await makeApp().request('/device-token', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ token: '' }),
    });
    expect(res.status).toBe(400);
  });

  it('DELETE /device-token/:token → deletes own token', async () => {
    const app = makeApp();
    await app.request('/device-token', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ token: 'tok-route-del' }),
    });

    const res = await app.request('/device-token/tok-route-del', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer u1' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { deleted: boolean } };
    expect(body.data.deleted).toBe(true);
  });

  it('DELETE /device-token/:token → deleted:false when not owned', async () => {
    const app = makeApp();
    await app.request('/device-token', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ token: 'tok-route-not-owned' }),
    });

    const res = await app.request('/device-token/tok-route-not-owned', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer u2' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { deleted: boolean } };
    expect(body.data.deleted).toBe(false);
  });
});
