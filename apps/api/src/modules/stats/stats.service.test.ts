import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { buildSummary, buildPersonalRecords } from './stats.service.js';

let mongod: MongoMemoryServer;
let exId: string;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_stats_service_test');
  const ex = await getDb().collection('exercises').insertOne({
    slug: 'bench-barbell',
    name: { en: 'Bench', vi: 'Đẩy ngực' },
    muscleGroup: 'chest',
    equipmentType: 'barbell',
    defaultIncrement: 2.5,
    isCustom: false,
    ownerUserId: null,
  });
  exId = ex.insertedId.toString();
  await getDb().collection('exercise_performance').insertMany([
    {
      userId: 'u1',
      exerciseId: exId,
      lastSets: [{ weightKg: 100, repsDone: 5 }],
      lastPerformedAt: new Date(),
      bestSet: { weightKg: 100, repsDone: 5, e1RM: 116.7 },
      totalVolume: 5000.4,
      totalSessions: 2,
    },
    {
      userId: 'u1',
      exerciseId: 'missing-exercise-id',
      lastSets: [],
      lastPerformedAt: new Date(),
      bestSet: { weightKg: 50, repsDone: 8, e1RM: 63.3 },
      totalVolume: 2000.1,
      totalSessions: 1,
    },
  ]);
  await getDb().collection('training_sessions').insertMany([
    { userId: 'u1', templateId: 't', sessionNumber: 1, startedAt: new Date(), status: 'completed' },
    { userId: 'u1', templateId: 't', sessionNumber: 2, startedAt: new Date(), status: 'completed' },
    { userId: 'u1', templateId: 't', sessionNumber: 3, startedAt: new Date(), status: 'in_progress' },
  ]);
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('buildSummary', () => {
  it('computes totals from performance and completed sessions', async () => {
    const summary = await buildSummary('u1');
    expect(summary.totalSessions).toBe(2);
    expect(summary.totalVolume).toBe(Math.round(5000.4 + 2000.1));
    expect(summary.totalExercises).toBe(2);
    expect(summary.totalPrs).toBe(2);
  });

  it('returns zeroed summary for a user with no data', async () => {
    const summary = await buildSummary('nobody');
    expect(summary).toEqual({
      totalSessions: 0, totalVolume: 0, totalPrs: 0, totalExercises: 0,
    });
  });
});

describe('buildPersonalRecords', () => {
  it('resolves exercise names and sorts by bestSet.e1RM descending', async () => {
    const records = await buildPersonalRecords('u1');
    expect(records).toHaveLength(2);
    expect(records[0]?.exerciseId).toBe(exId);
    expect(records[0]?.name).toEqual({ en: 'Bench', vi: 'Đẩy ngực' });
    expect(records[0]?.bestSet.e1RM).toBe(116.7);
    expect(records[1]?.exerciseId).toBe('missing-exercise-id');
    expect(records[1]?.name).toEqual({ en: 'missing-exercise-id', vi: 'missing-exercise-id' });
    expect(records[1]?.bestSet.e1RM).toBe(63.3);
  });

  it('returns empty array for a user with no performance', async () => {
    expect(await buildPersonalRecords('nobody')).toEqual([]);
  });
});
