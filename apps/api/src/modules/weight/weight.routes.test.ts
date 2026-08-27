import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import { ensureWeightIndexes } from './weight.repo.js';
import { makeWeightRoutes } from './weight.routes.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_weight_routes_test');
  await ensureWeightIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

function makeApp() {
  return makeWeightRoutes({ verify });
}

describe('weight routes', () => {
  it('401 without token', async () => {
    const res = await makeApp().request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weightKg: 70 }),
    });
    expect(res.status).toBe(401);
  });

  it('POST / → 201 with the created log', async () => {
    const app = makeApp();
    const res = await app.request('/', { method: 'POST', headers: H, body: JSON.stringify({ weightKg: 70.5 }) });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; data: { id: string; userId: string; weightKg: number } };
    expect(body.success).toBe(true);
    expect(body.data.userId).toBe('u1');
    expect(body.data.weightKg).toBe(70.5);
    expect(body.data.id).toMatch(/^[a-f0-9]{24}$/);
  });

  it('POST / → 400 on invalid body (non-positive weight)', async () => {
    const res = await makeApp().request('/', { method: 'POST', headers: H, body: JSON.stringify({ weightKg: 0 }) });
    expect(res.status).toBe(400);
  });

  it('GET /history → returns logs newest-first', async () => {
    const app = makeApp();
    await app.request('/', { method: 'POST', headers: H, body: JSON.stringify({ weightKg: 70, loggedAt: '2024-01-01T00:00:00.000Z' }) });
    await app.request('/', { method: 'POST', headers: H, body: JSON.stringify({ weightKg: 71, loggedAt: '2024-02-01T00:00:00.000Z' }) });

    const res = await app.request('/history', { headers: { Authorization: 'Bearer u1' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: Array<{ weightKg: number; loggedAt: string }> };
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const first = new Date(body.data[0].loggedAt).getTime();
    const second = new Date(body.data[1].loggedAt).getTime();
    expect(first).toBeGreaterThanOrEqual(second);
  });
});
