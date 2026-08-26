import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { AuthProvider } from '@gigaflow/shared';
import { ensureUserIndexes, upsertByAuthId, findByAuthId } from './user.repo.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('UserRepository', () => {
  it('inserts a guest on first upsert, sets defaults', async () => {
    const u = await upsertByAuthId({ authId: 'uid_a', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    expect(u.authSource).toBe('firebase');
    expect(u.isGuest).toBe(true);
    expect(u.timezone).toBe('Asia/Ho_Chi_Minh');
    expect(u.language).toBe('en');
  });
  it('is idempotent — same authId does not create a second doc', async () => {
    await upsertByAuthId({ authId: 'uid_b', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    await upsertByAuthId({ authId: 'uid_b', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    const found = await findByAuthId('uid_b');
    expect(found).not.toBeNull();
  });
  it('updates provider/email in place on link (anonymous -> google)', async () => {
    await upsertByAuthId({ authId: 'uid_c', authProvider: AuthProvider.ANONYMOUS, isGuest: true });
    const linked = await upsertByAuthId({ authId: 'uid_c', authProvider: AuthProvider.GOOGLE, isGuest: false, email: 'c@x.com' });
    expect(linked.authProvider).toBe(AuthProvider.GOOGLE);
    expect(linked.isGuest).toBe(false);
    expect(linked.email).toBe('c@x.com');
  });
});
