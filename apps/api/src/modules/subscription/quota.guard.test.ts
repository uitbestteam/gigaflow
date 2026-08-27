import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { GenerationType, PLAN_LIMITS, SubscriptionPlan } from '@gigaflow/shared';
import { checkQuota } from './quota.service.js';
import { quotaGuard } from './quota.guard.js';

let mongod: MongoMemoryServer;
const NOW = new Date();

async function makeUser(authId: string) {
  await getDb().collection('users').insertOne({
    authId,
    authSource: 'firebase',
    authProvider: 'anonymous',
    isGuest: true,
    timezone: 'Asia/Ho_Chi_Minh',
    language: 'en',
    createdAt: NOW,
    updatedAt: NOW,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_guard_test');
  await makeUser('u1');
  await makeUser('u2');
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

function app(authId: string) {
  const a = new Hono();
  a.use('/gen', async (c, next) => {
    c.set('user', { authId } as never);
    await next();
  });
  a.use('/gen', quotaGuard(GenerationType.WORKOUT));
  a.post('/gen', (c) => c.json({ success: true }));
  return a;
}

describe('quotaGuard', () => {
  it('allows when under limit and consumes one unit of quota', async () => {
    const res = await app('u1').request('/gen', { method: 'POST' });
    expect(res.status).toBe(200);
    expect((await checkQuota('u1', GenerationType.WORKOUT, NOW)).used).toBe(1);
  });

  it('returns 429 once the guard itself has exhausted the quota', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    const a = app('u2');
    let lastStatus = 0;
    for (let i = 0; i < limit; i++) {
      const res = await a.request('/gen', { method: 'POST' });
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(200); // exactly `limit` requests all succeed

    const res = await a.request('/gen', { method: 'POST' });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
    expect((await checkQuota('u2', GenerationType.WORKOUT, NOW)).used).toBe(limit);
  });
});
