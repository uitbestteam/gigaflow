import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureUserIndexes } from './user.repo.js';
import { firebaseAuth, type TokenVerifier } from './firebase-auth.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test_mw');
  await ensureUserIndexes();
});
afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

const fakeVerify: TokenVerifier = async (t) => {
  if (t === 'good-anon') return { uid: 'uid_anon', signInProvider: 'anonymous' };
  if (t === 'good-google') return { uid: 'uid_anon', email: 'g@x.com', signInProvider: 'google.com' };
  if (t === 'unsupported-provider') return { uid: 'uid_x', signInProvider: 'facebook.com' };
  throw new Error('invalid token');
};

function app() {
  const a = new Hono();
  a.use('/me', firebaseAuth({ verify: fakeVerify }));
  a.get('/me', (c) => c.json({ success: true, data: c.get('user') }));
  return a;
}

describe('firebaseAuth', () => {
  it('401 when no Authorization header', async () => {
    const res = await app().request('/me');
    expect(res.status).toBe(401);
  });
  it('401 when token invalid', async () => {
    const res = await app().request('/me', { headers: { Authorization: 'Bearer nope' } });
    expect(res.status).toBe(401);
  });
  it('200 + guest user for anonymous token', async () => {
    const res = await app().request('/me', { headers: { Authorization: 'Bearer good-anon' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { data: { authId: string; isGuest: boolean } };
    expect(body.data.authId).toBe('uid_anon');
    expect(body.data.isGuest).toBe(true);
  });
  it('same uid upgraded to google updates user in place', async () => {
    await app().request('/me', { headers: { Authorization: 'Bearer good-anon' } });
    const res = await app().request('/me', { headers: { Authorization: 'Bearer good-google' } });
    const body = (await res.json()) as { data: { isGuest: boolean; authProvider: string; email?: string } };
    expect(body.data.isGuest).toBe(false);
    expect(body.data.authProvider).toBe('google');
    expect(body.data.email).toBe('g@x.com');
  });
  it('403 when token verifies but sign-in provider is unsupported', async () => {
    const res = await app().request('/me', { headers: { Authorization: 'Bearer unsupported-provider' } });
    expect(res.status).toBe(403);
  });
});
