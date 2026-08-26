import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { GenerationType, PLAN_LIMITS, SubscriptionPlan } from '@gigaflow/shared';
import { incrementUsage } from './quota.service.js';
import { quotaGuard } from './quota.guard.js';

let mongod: MongoMemoryServer;
const NOW = new Date();
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_guard_test');
  await getDb().collection('users').insertOne({
    authId: 'u1',
    authSource: 'firebase',
    authProvider: 'anonymous',
    isGuest: true,
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  });
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

function app() {
  const a = new Hono();
  a.use('/gen', async (c, next) => {
    c.set('user', { authId: 'u1' } as never);
    await next();
  });
  a.use('/gen', quotaGuard(GenerationType.WORKOUT));
  a.post('/gen', (c) => c.json({ success: true }));
  return a;
}

describe('quotaGuard', () => {
  it('allows when under limit', async () => {
    const res = await app().request('/gen', { method: 'POST' });
    expect(res.status).toBe(200);
  });
  it('returns 429 when the quota is exhausted', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    for (let i = 0; i < limit; i++) await incrementUsage('u1', GenerationType.WORKOUT, NOW);
    const res = await app().request('/gen', { method: 'POST' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});
