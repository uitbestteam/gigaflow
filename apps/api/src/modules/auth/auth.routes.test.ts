import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { ensureUserIndexes } from './user.repo.js';
import { makeAuthRoutes } from './auth.routes.js';
import type { TokenVerifier } from './firebase-auth.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test_routes');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const verify: TokenVerifier = async (t) =>
  t === 'ok' ? { uid: 'uid_route', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));

describe('POST /session', () => {
  it('401 without token', async () => {
    const app = makeAuthRoutes({ verify });
    const res = await app.request('/session', { method: 'POST' });
    expect(res.status).toBe(401);
  });
  it('creates then returns the same user (idempotent)', async () => {
    const app = makeAuthRoutes({ verify });
    await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    const res = await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { authId: string } };
    expect(body.success).toBe(true);
    expect(body.data.authId).toBe('uid_route');
    const count = await getDb().collection('users').countDocuments({ authId: 'uid_route' });
    expect(count).toBe(1);
  });
});
