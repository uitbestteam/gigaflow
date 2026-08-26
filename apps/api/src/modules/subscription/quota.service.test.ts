import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { GenerationType, SubscriptionPlan, PLAN_LIMITS } from '@gigaflow/shared';
import { checkQuota, incrementUsage, rollbackUsage } from './quota.service.js';

let mongod: MongoMemoryServer;
const NOW = new Date('2026-08-26T00:00:00Z');
beforeAll(async () => { mongod = await MongoMemoryServer.create(); await connectDb(mongod.getUri(), 'gigaflow_quota_test'); });
afterAll(async () => { await closeDb(); await mongod.stop(); });
beforeEach(async () => { await getDb().collection('users').deleteMany({}); });

async function makeUser(authId: string, sub?: unknown) {
  await getDb().collection('users').insertOne({ authId, authSource: 'firebase', authProvider: 'anonymous', isGuest: true, timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW, ...(sub ? { subscription: sub } : {}) });
}

describe('quota.service', () => {
  it('initializes a FREE period and allows the first generation', async () => {
    await makeUser('u1');
    const s = await checkQuota('u1', GenerationType.WORKOUT, NOW);
    expect(s.allowed).toBe(true);
    expect(s.plan).toBe(SubscriptionPlan.FREE);
    expect(s.limit).toBe(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT]);
    expect(s.used).toBe(0);
  });
  it('blocks once usage reaches the limit', async () => {
    await makeUser('u2');
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    for (let i = 0; i < limit; i++) await incrementUsage('u2', GenerationType.WORKOUT, NOW);
    expect((await checkQuota('u2', GenerationType.WORKOUT, NOW)).allowed).toBe(false);
  });
  it('rollback frees one and floors at zero', async () => {
    await makeUser('u3');
    await incrementUsage('u3', GenerationType.MEAL, NOW);
    await rollbackUsage('u3', GenerationType.MEAL);
    await rollbackUsage('u3', GenerationType.MEAL); // floor
    expect((await checkQuota('u3', GenerationType.MEAL, NOW)).used).toBe(0);
  });
  it('resets usage when the period has expired', async () => {
    await makeUser('u4', { plan: 'free', aiUsage: { workout: 10, meal: 0, inbody: 0 }, periodStart: new Date('2026-06-01T00:00:00Z') });
    const s = await checkQuota('u4', GenerationType.WORKOUT, NOW); // >30 days later
    expect(s.used).toBe(0);
    expect(s.allowed).toBe(true);
  });
});
