import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureExerciseIndexes } from './exercise.repo.js';
import { seedPresets } from './seed-exercises.js';
import { makeExerciseRoutes } from './exercise.routes.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_exroutes_test');
  await ensureExerciseIndexes();
  await seedPresets();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const verify: TokenVerifier = async (t) =>
  t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));

const H = { Authorization: 'Bearer u1' };

describe('exercise routes', () => {
  it('401 without token', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/');
    expect(res.status).toBe(401);
  });
  it('GET / lists presets for an authed (guest) user', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/', { headers: H });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ slug: string }> };
    expect(body.data.length).toBeGreaterThanOrEqual(50);
  });
  it('POST / creates a custom exercise (201) then GET includes it', async () => {
    const app = makeExerciseRoutes({ verify });
    const create = await app.request('/', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: { en: 'My Row', vi: 'Chèo của tôi' }, muscleGroup: 'back', equipmentType: 'dumbbell' }),
    });
    expect(create.status).toBe(201);
    const listed = await app.request('/?muscleGroup=back', { headers: H });
    const body = (await listed.json()) as { data: Array<{ slug: string }> };
    expect(body.data.some((e) => e.slug === 'my-row')).toBe(true);
  });
  it('POST / duplicate custom slug → 409', async () => {
    const app = makeExerciseRoutes({ verify });
    const mk = () =>
      app.request('/', {
        method: 'POST',
        headers: { ...H, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: { en: 'Dup Ex', vi: 'Trùng' }, muscleGroup: 'arms', equipmentType: 'dumbbell' }),
      });
    await mk();
    const res = await mk();
    expect(res.status).toBe(409);
  });
  it('POST / invalid body → 400', async () => {
    const res = await makeExerciseRoutes({ verify }).request('/', {
      method: 'POST',
      headers: { ...H, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: { en: 'x' } }),
    });
    expect(res.status).toBe(400);
  });
});
