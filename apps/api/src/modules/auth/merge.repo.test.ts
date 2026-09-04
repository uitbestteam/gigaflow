import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { mergeGuestData } from './merge.repo.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test_merge');
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});
beforeEach(async () => {
  const db = getDb();
  for (const c of ['plans', 'training_sessions', 'meal_plans', 'weight_logs', 'users', 'exercises']) {
    await db.collection(c).deleteMany({});
  }
});

describe('mergeGuestData', () => {
  it('reassigns the guest documents to the target and deletes the guest user', async () => {
    const db = getDb();
    await db.collection('plans').insertMany([
      { userId: 'guest', name: 'A' },
      { userId: 'guest', name: 'B' },
      { userId: 'other', name: 'C' },
    ]);
    await db.collection('training_sessions').insertOne({ userId: 'guest', n: 1 });
    await db.collection('weight_logs').insertOne({ userId: 'guest', kg: 70 });
    await db.collection('exercises').insertOne({ name: 'global' }); // no userId → untouched
    await db.collection('users').insertOne({ authId: 'guest', isGuest: true });
    await db.collection('users').insertOne({ authId: 'target', isGuest: false });

    const res = await mergeGuestData('guest', 'target');

    expect(res.movedByCollection.plans).toBe(2);
    expect(res.movedByCollection.training_sessions).toBe(1);
    expect(res.movedByCollection.weight_logs).toBe(1);
    expect(res.totalMoved).toBe(4);
    expect(res.guestUserDeleted).toBe(true);

    expect(await db.collection('plans').countDocuments({ userId: 'target' })).toBe(2);
    expect(await db.collection('plans').countDocuments({ userId: 'guest' })).toBe(0);
    expect(await db.collection('plans').countDocuments({ userId: 'other' })).toBe(1);
    expect(await db.collection('users').countDocuments({ authId: 'guest' })).toBe(0);
    expect(await db.collection('users').countDocuments({ authId: 'target' })).toBe(1);
    expect(await db.collection('exercises').countDocuments({})).toBe(1);
  });

  it('is a safe no-op count when the guest owns nothing', async () => {
    const res = await mergeGuestData('ghost', 'target');
    expect(res.totalMoved).toBe(0);
    expect(res.guestUserDeleted).toBe(false);
  });
});
