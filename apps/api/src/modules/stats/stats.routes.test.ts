import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { makeStatsRoutes } from './stats.routes.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';

let mongod: MongoMemoryServer;
let exId: string;

const verify: TokenVerifier = async (t) =>
  t === 'ok' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_stats_routes_test');

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
      totalVolume: 5000,
      totalSessions: 2,
    },
    {
      userId: 'u1',
      exerciseId: 'other',
      lastSets: [],
      lastPerformedAt: new Date(),
      bestSet: { weightKg: 50, repsDone: 8, e1RM: 63.3 },
      totalVolume: 2000,
      totalSessions: 1,
    },
  ]);

  await getDb().collection('training_sessions').insertMany([
    { userId: 'u1', templateId: 't', sessionNumber: 1, startedAt: new Date(), status: 'completed' },
    { userId: 'u1', templateId: 't', sessionNumber: 2, startedAt: new Date(), status: 'in_progress' },
  ]);
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('stats routes', () => {
  it('401 without token', async () => {
    const app = makeStatsRoutes({ verify });
    const res = await app.request('/summary');
    expect(res.status).toBe(401);
  });

  it('GET /summary returns the totals', async () => {
    const app = makeStatsRoutes({ verify });
    const res = await app.request('/summary', { headers: { Authorization: 'Bearer ok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { totalSessions: number; totalVolume: number; totalExercises: number; totalPrs: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.totalSessions).toBe(1);
    expect(body.data.totalVolume).toBe(7000);
    expect(body.data.totalExercises).toBe(2);
    expect(body.data.totalPrs).toBe(2);
  });

  it('GET /prs returns records sorted by e1RM desc', async () => {
    const app = makeStatsRoutes({ verify });
    const res = await app.request('/prs', { headers: { Authorization: 'Bearer ok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ exerciseId: string; bestSet: { e1RM: number } }>;
    };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);
    expect(body.data[0]?.exerciseId).toBe(exId);
    expect(body.data[0]?.bestSet.e1RM).toBe(116.7);
    expect(body.data[1]?.bestSet.e1RM).toBe(63.3);
  });

  it('GET /awards includes FIRST_WORKOUT earned:true', async () => {
    const app = makeStatsRoutes({ verify });
    const res = await app.request('/awards', { headers: { Authorization: 'Bearer ok' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: Array<{ key: string; earned: boolean }>;
    };
    expect(body.success).toBe(true);
    const firstWorkout = body.data.find((a) => a.key === 'first_workout');
    expect(firstWorkout?.earned).toBe(true);
  });
});
