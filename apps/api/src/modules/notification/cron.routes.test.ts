import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ensureUserIndexes } from '../auth/user.repo.js';
import { ensureDeviceTokenIndexes } from './device-token.repo.js';
import { ensureTrainingIndexes } from '../training/session.repo.js';
import { makeCronRoutes } from './cron.routes.js';
import type { PushSender, PushMessage, PushSendResult } from './push-sender.js';

let mongod: MongoMemoryServer;

class FakePushSender implements PushSender {
  calls: { tokens: string[]; message: PushMessage }[] = [];
  send = async (tokens: string[], message: PushMessage): Promise<PushSendResult> => {
    this.calls.push({ tokens, message });
    return { invalidTokens: [] };
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_cron_routes_test');
  await ensureUserIndexes();
  await ensureDeviceTokenIndexes();
  await ensureTrainingIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('cron routes', () => {
  it('rejects without the Cloud Tasks marker header', async () => {
    const app = makeCronRoutes({ sender: new FakePushSender() });

    const res = await app.request('/workout-reminders', { method: 'POST' });

    expect(res.status).toBe(401);
  });

  it('runs the reminder job with the marker header', async () => {
    const sender = new FakePushSender();
    const app = makeCronRoutes({ sender });

    const res = await app.request('/workout-reminders', {
      method: 'POST',
      headers: { 'X-CloudTasks-QueueName': 'workout-reminders' },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; data: { notified: number } };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ notified: 0 });
  });
});
