import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, getDb, closeDb } from './db';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test');
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('db', () => {
  it('getDb returns a usable Db after connect', async () => {
    const db = getDb();
    await db.collection('ping').insertOne({ ok: 1 });
    const doc = await db.collection('ping').findOne({ ok: 1 });
    expect(doc?.ok).toBe(1);
  });
});
