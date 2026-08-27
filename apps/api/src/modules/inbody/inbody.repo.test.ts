import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import type { InbodyMetrics } from '@gigaflow/shared';
import {
  ensureInbodyIndexes, createInbodyResult, findLatestInbody, findInbodyForUser,
} from './inbody.repo.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_inbody_test');
  await ensureInbodyIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const metrics: InbodyMetrics = {
  weightKg: 70.5,
  bmi: 22.1,
  bodyFatPercent: 15.2,
  skeletalMuscleMassKg: 32.4,
  bodyFatMassKg: 10.7,
  visceralFatLevel: 5,
};

describe('inbody.repo', () => {
  it('creates an inbody result and findLatestInbody returns it', async () => {
    const result = await createInbodyResult('u1', metrics);
    expect(result.id).toMatch(/^[a-f0-9]{24}$/);
    expect(result.userId).toBe('u1');
    expect(result.metrics).toEqual(metrics);
    expect(result.takenAt).toBeInstanceOf(Date);
    expect(result.createdAt).toBeInstanceOf(Date);

    const latest = await findLatestInbody('u1');
    expect(latest?.id).toBe(result.id);
    expect(latest?.metrics).toEqual(metrics);
  });

  it('findLatestInbody returns the newest by createdAt', async () => {
    const first = await createInbodyResult('u2', metrics);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await createInbodyResult('u2', { ...metrics, weightKg: 71 });

    const latest = await findLatestInbody('u2');
    expect(latest?.id).toBe(second.id);
    expect(latest?.id).not.toBe(first.id);
  });

  it('findLatestInbody returns null when there is no result for the user', async () => {
    expect(await findLatestInbody('no-such-user')).toBeNull();
  });

  it('findInbodyForUser is owner-scoped', async () => {
    const result = await createInbodyResult('owner', metrics);
    expect(await findInbodyForUser('someone-else', result.id)).toBeNull();
    const found = await findInbodyForUser('owner', result.id);
    expect(found?.id).toBe(result.id);
  });

  it('findInbodyForUser returns null for an invalid hex id', async () => {
    expect(await findInbodyForUser('u1', 'not-a-valid-id')).toBeNull();
  });
});
