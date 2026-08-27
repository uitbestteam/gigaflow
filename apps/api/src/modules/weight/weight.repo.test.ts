import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureWeightIndexes, logWeight, listWeights } from './weight.repo.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_weight_test');
  await ensureWeightIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('weight.repo', () => {
  it('logs a weight entry with defaults', async () => {
    const log = await logWeight('u1', 70.5);
    expect(log.id).toMatch(/^[a-f0-9]{24}$/);
    expect(log.userId).toBe('u1');
    expect(log.weightKg).toBe(70.5);
    expect(log.loggedAt).toBeInstanceOf(Date);
    expect(log.createdAt).toBeInstanceOf(Date);
  });

  it('logs a weight entry with an explicit loggedAt', async () => {
    const loggedAt = new Date('2024-01-01T00:00:00.000Z');
    const log = await logWeight('u1', 71, loggedAt);
    expect(log.loggedAt).toEqual(loggedAt);
  });

  it('lists weights newest-first, scoped to the owner', async () => {
    const first = await logWeight('u2', 80, new Date('2024-01-01T00:00:00.000Z'));
    const second = await logWeight('u2', 81, new Date('2024-02-01T00:00:00.000Z'));
    const third = await logWeight('u2', 82, new Date('2024-03-01T00:00:00.000Z'));
    await logWeight('someone-else', 99);

    const logs = await listWeights('u2');
    expect(logs.map((l) => l.id)).toEqual([third.id, second.id, first.id]);
    expect(logs.every((l) => l.userId === 'u2')).toBe(true);
  });

  it('respects the limit parameter', async () => {
    for (let i = 0; i < 5; i++) await logWeight('u3', 60 + i);
    const logs = await listWeights('u3', 2);
    expect(logs.length).toBe(2);
  });
});
