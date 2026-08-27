import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { listPerformance, countCompletedSessions } from './stats.repo.js';
import { findByIds } from '../exercise/exercise.repo.js';

let mongod: MongoMemoryServer;
let exId: string;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_stats_test');
  const ex = await getDb().collection('exercises').insertOne({ slug: 'bench-barbell', name: { en: 'Bench', vi: 'Đẩy ngực' }, muscleGroup: 'chest', equipmentType: 'barbell', defaultIncrement: 2.5, isCustom: false, ownerUserId: null });
  exId = ex.insertedId.toString();
  await getDb().collection('exercise_performance').insertMany([
    { userId: 'u1', exerciseId: exId, lastSets: [{ weightKg: 100, repsDone: 5 }], lastPerformedAt: new Date(), bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 }, totalVolume: 5000, totalSessions: 2 },
    { userId: 'u1', exerciseId: 'other', lastSets: [], lastPerformedAt: new Date(), bestSet: { weightKg: 50, repsDone: 8, e1RM: 63.3 }, totalVolume: 2000, totalSessions: 1 },
  ]);
  await getDb().collection('training_sessions').insertMany([
    { userId: 'u1', templateId: 't', sessionNumber: 1, startedAt: new Date(), status: 'completed' },
    { userId: 'u1', templateId: 't', sessionNumber: 2, startedAt: new Date(), status: 'in_progress' },
  ]);
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('stats repo', () => {
  it('listPerformance returns the user perf docs', async () => {
    expect((await listPerformance('u1')).length).toBe(2);
  });
  it('countCompletedSessions counts only completed', async () => {
    expect(await countCompletedSessions('u1')).toBe(1);
  });
  it('findByIds maps real ids and skips bad hex', async () => {
    const map = await findByIds([exId, 'not-hex']);
    expect(map.get(exId)?.slug).toBe('bench-barbell');
    expect(map.size).toBe(1);
  });
});
