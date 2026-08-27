import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { AuthProvider, Language } from '@gigaflow/shared';
import { ensureUserIndexes, upsertByAuthId } from '../auth/user.repo.js';
import { ensureDeviceTokenIndexes, upsertDeviceToken, listTokens } from './device-token.repo.js';
import { notifyJobComplete, notifyJobError } from './notification.service.js';
import type { PushSender, PushMessage, PushSendResult } from './push-sender.js';

let mongod: MongoMemoryServer;

class FakePushSender implements PushSender {
  calls: { tokens: string[]; message: PushMessage }[] = [];
  invalidTokens: string[] = [];
  send = async (tokens: string[], message: PushMessage): Promise<PushSendResult> => {
    this.calls.push({ tokens, message });
    return { invalidTokens: this.invalidTokens };
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_notification_test');
  await ensureUserIndexes();
  await ensureDeviceTokenIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('notification.service', () => {
  it('sends a localized push to the user tokens on job complete', async () => {
    await upsertByAuthId({ authId: 'user-en', authProvider: AuthProvider.PASSWORD, isGuest: false });
    await upsertDeviceToken('user-en', 'tok-1');
    await upsertDeviceToken('user-en', 'tok-2');
    const sender = new FakePushSender();

    await notifyJobComplete('user-en', 'workout', { sender });

    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0]?.tokens.sort()).toEqual(['tok-1', 'tok-2']);
    expect(sender.calls[0]?.message).toEqual({
      title: 'Workout plan ready',
      body: 'Your AI workout plan is ready.',
    });
  });

  it('sends the localized error message for the user language', async () => {
    const user = await upsertByAuthId({ authId: 'user-vi', authProvider: AuthProvider.PASSWORD, isGuest: false });
    // Force language to Vietnamese directly since upsertByAuthId defaults to EN on insert.
    const { getDb } = await import('../../lib/db.js');
    await getDb().collection('users').updateOne({ authId: user.authId }, { $set: { language: Language.VI } });
    await upsertDeviceToken('user-vi', 'tok-vi');
    const sender = new FakePushSender();

    await notifyJobError('user-vi', 'meal', { sender });

    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0]?.message.title).toBe('Tạo thực đơn thất bại');
  });

  it('does not send when the user has no device tokens', async () => {
    await upsertByAuthId({ authId: 'user-no-tokens', authProvider: AuthProvider.PASSWORD, isGuest: false });
    const sender = new FakePushSender();

    await notifyJobComplete('user-no-tokens', 'inbody', { sender });

    expect(sender.calls).toHaveLength(0);
  });

  it('swallows errors thrown by the sender', async () => {
    await upsertByAuthId({ authId: 'user-throw', authProvider: AuthProvider.PASSWORD, isGuest: false });
    await upsertDeviceToken('user-throw', 'tok-throw');
    const sender: PushSender = {
      send: async () => {
        throw new Error('fcm down');
      },
    };

    await expect(notifyJobComplete('user-throw', 'workout', { sender })).resolves.toBeUndefined();
  });

  it('deletes tokens reported as invalid by the sender', async () => {
    await upsertByAuthId({ authId: 'user-dead-token', authProvider: AuthProvider.PASSWORD, isGuest: false });
    await upsertDeviceToken('user-dead-token', 'dead');
    await upsertDeviceToken('user-dead-token', 'alive');
    const sender = new FakePushSender();
    sender.invalidTokens = ['dead'];

    await notifyJobComplete('user-dead-token', 'workout', { sender });

    const remaining = await listTokens('user-dead-token');
    expect(remaining.map((t) => t.token).sort()).toEqual(['alive']);
  });
});
