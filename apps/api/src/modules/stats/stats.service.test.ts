import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { buildSummary, buildPersonalRecords, buildVolumeByWeek, computeStreaks } from './stats.service.js';

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
      totalSessions: 0,
      totalVolume: 0,
      totalPrs: 0,
      totalExercises: 0,
      currentStreakWeeks: 0,
      longestStreakWeeks: 0,
      totalMealPlans: 0,
    });
  });

  it('reports the current/longest streak and meal-plan count', async () => {
    await getDb().collection('meal_plans').insertMany([
      { userId: 'u1', name: 'A', isActive: true, createdAt: new Date() },
      { userId: 'u1', name: 'B', isActive: false, createdAt: new Date() },
    ]);
    const summary = await buildSummary('u1');
    // Both completed sessions land in the current ISO week → streak of 1.
    expect(summary.currentStreakWeeks).toBe(1);
    expect(summary.longestStreakWeeks).toBe(1);
    expect(summary.totalMealPlans).toBe(2);
  });
});

describe('computeStreaks', () => {
  const monday = (iso: string) => new Date(`${iso}T12:00:00.000Z`);

  it('counts consecutive weeks ending at the current week', () => {
    // now = Wed 2026-09-02; current week Mon 08-31, prior weeks 08-24, 08-17.
    const now = new Date('2026-09-02T00:00:00.000Z');
    const { current, longest } = computeStreaks(
      [monday('2026-09-01'), monday('2026-08-25'), monday('2026-08-18')],
      now,
    );
    expect(current).toBe(3);
    expect(longest).toBe(3);
  });

  it('resets the current streak when the current week has no session but keeps the longest run', () => {
    const now = new Date('2026-09-02T00:00:00.000Z');
    const { current, longest } = computeStreaks(
      [monday('2026-08-11'), monday('2026-08-18'), monday('2026-08-25')],
      now,
    );
    expect(current).toBe(0);
    expect(longest).toBe(3);
  });

  it('does not count a gap as consecutive', () => {
    const now = new Date('2026-09-02T00:00:00.000Z');
    const { current, longest } = computeStreaks(
      [monday('2026-09-01'), monday('2026-08-11')],
      now,
    );
    expect(current).toBe(1);
    expect(longest).toBe(1);
  });

  it('is empty for no sessions', () => {
    expect(computeStreaks([], new Date('2026-09-02T00:00:00.000Z'))).toEqual({ current: 0, longest: 0 });
  });
});

describe('buildVolumeByWeek', () => {
  it('aggregates completed-set volume per ISO week split by muscle group', async () => {
    const ex = await getDb().collection('exercises').insertOne({
      slug: 'squat-barbell',
      name: { en: 'Squat', vi: 'Squat' },
      muscleGroup: 'legs',
      equipmentType: 'barbell',
      defaultIncrement: 2.5,
      isCustom: false,
      ownerUserId: null,
    });
    const legsId = ex.insertedId.toString();
    const week1 = new Date('2026-08-10T10:00:00.000Z'); // Mon 2026-08-10
    const week2 = new Date('2026-08-19T10:00:00.000Z'); // week of Mon 2026-08-17
    const s1 = await getDb().collection('training_sessions').insertOne({
      userId: 'vol', templateId: 't', sessionNumber: 1, startedAt: week1, finishedAt: week1, status: 'completed',
    });
    const s2 = await getDb().collection('training_sessions').insertOne({
      userId: 'vol', templateId: 't', sessionNumber: 2, startedAt: week2, finishedAt: week2, status: 'completed',
    });
    await getDb().collection('set_logs').insertMany([
      // week1: legs 100*5 = 500, chest 60*10 = 600
      { sessionId: s1.insertedId.toString(), slotId: 'sl', exerciseId: legsId, setNumber: 1, weightKg: 100, repsDone: 5, weightSuggested: 100, repsSuggested: 5, isCompleted: true, loggedAt: week1 },
      { sessionId: s1.insertedId.toString(), slotId: 'sl', exerciseId: exId, setNumber: 1, weightKg: 60, repsDone: 10, weightSuggested: 60, repsSuggested: 10, isCompleted: true, loggedAt: week1 },
      // an uncompleted set is ignored
      { sessionId: s1.insertedId.toString(), slotId: 'sl', exerciseId: exId, setNumber: 2, weightKg: 999, repsDone: 999, weightSuggested: 0, repsSuggested: 0, isCompleted: false, loggedAt: week1 },
      // week2: legs 80*8 = 640
      { sessionId: s2.insertedId.toString(), slotId: 'sl', exerciseId: legsId, setNumber: 1, weightKg: 80, repsDone: 8, weightSuggested: 80, repsSuggested: 8, isCompleted: true, loggedAt: week2 },
    ]);

    const weeks = await buildVolumeByWeek('vol');
    expect(weeks).toHaveLength(2);
    // oldest → newest
    expect(weeks[0]?.weekStart.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(weeks[0]?.byMuscleGroup).toEqual({ legs: 500, chest: 600 });
    expect(weeks[0]?.total).toBe(1100);
    expect(weeks[1]?.weekStart.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(weeks[1]?.byMuscleGroup).toEqual({ legs: 640 });
    expect(weeks[1]?.total).toBe(640);
  });

  it('returns an empty array when the user has no finished sets', async () => {
    expect(await buildVolumeByWeek('nobody')).toEqual([]);
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
