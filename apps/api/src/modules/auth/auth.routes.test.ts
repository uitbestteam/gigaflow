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

describe('POST /profile', () => {
  const validProfile = {
    goal: 'strength',
    experienceLevel: 'beginner',
    daysPerWeek: 4,
    availableEquipment: ['barbell', 'dumbbell'],
  };

  it('401 without token', async () => {
    const app = makeAuthRoutes({ verify });
    const res = await app.request('/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validProfile),
    });
    expect(res.status).toBe(401);
  });

  it('400 on an invalid body', async () => {
    const app = makeAuthRoutes({ verify });
    // Ensure the user doc exists first.
    await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    const res = await app.request('/profile', {
      method: 'POST',
      headers: { Authorization: 'Bearer ok', 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal: 'strength', experienceLevel: 'beginner', daysPerWeek: 9 }),
    });
    expect(res.status).toBe(400);
  });

  it('persists the profile + onboardedAt and returns the updated user', async () => {
    const app = makeAuthRoutes({ verify });
    await app.request('/session', { method: 'POST', headers: { Authorization: 'Bearer ok' } });
    const res = await app.request('/profile', {
      method: 'POST',
      headers: { Authorization: 'Bearer ok', 'Content-Type': 'application/json' },
      body: JSON.stringify(validProfile),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { authId: string; profile?: typeof validProfile; onboardedAt?: string };
    };
    expect(body.success).toBe(true);
    expect(body.data.authId).toBe('uid_route');
    expect(body.data.profile).toEqual(validProfile);
    expect(body.data.onboardedAt).toBeTruthy();

    const doc = await getDb().collection('users').findOne({ authId: 'uid_route' });
    expect(doc?.profile).toMatchObject(validProfile);
    expect(doc?.onboardedAt).toBeInstanceOf(Date);
  });
});
