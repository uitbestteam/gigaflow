import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureExerciseIndexes } from '../exercise/exercise.repo.js';
import { seedPresets } from '../exercise/seed-exercises.js';
import { ensureWorkoutIndexes } from './workout.repo.js';
import { makeWorkoutRoutes } from './workout.routes.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wroutes_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

describe('workout routes', () => {
  it('401 without token', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active');
    expect(res.status).toBe(401);
  });
  it('GET /active returns null when no plan', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/active', { headers: { Authorization: 'Bearer u1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: unknown };
    expect(body.data).toBeNull();
  });
  it('POST /from-template creates a PPL plan (201) then GET /active returns it nested', async () => {
    const app = makeWorkoutRoutes({ verify });
    const create = await app.request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'ppl' }) });
    expect(create.status).toBe(201);
    const active = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
    const body = (await active.json()) as { data: { templateType: string; templates: Array<{ slots: unknown[] }> } };
    expect(body.data.templateType).toBe('ppl');
    expect(body.data.templates.length).toBe(6);
    expect(body.data.templates[0].slots.length).toBeGreaterThan(0);
  });
  it('POST /from-template with custom → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'custom' }) });
    expect(res.status).toBe(400);
  });
  it('POST /from-template with invalid type → 400', async () => {
    const res = await makeWorkoutRoutes({ verify }).request('/from-template', { method: 'POST', headers: H, body: JSON.stringify({ templateType: 'bro' }) });
    expect(res.status).toBe(400);
  });
});
