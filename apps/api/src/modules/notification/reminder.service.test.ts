import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { AuthProvider, SessionStatus } from '@gigaflow/shared';
import { ensureUserIndexes, upsertByAuthId } from '../auth/user.repo.js';
import { ensureDeviceTokenIndexes, upsertDeviceToken } from './device-token.repo.js';
import { ensureTrainingIndexes } from '../training/session.repo.js';
import { findUsersDueForWorkoutReminder, sendWorkoutReminders } from './reminder.service.js';
import type { PushSender, PushMessage } from './push-sender.js';

let mongod: MongoMemoryServer;

class FakePushSender implements PushSender {
  calls: { tokens: string[]; message: PushMessage }[] = [];
  send = async (tokens: string[], message: PushMessage): Promise<void> => {
    this.calls.push({ tokens, message });
  };
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

async function insertSession(userId: string, patch: {
  status: SessionStatus;
  startedAt: Date;
  finishedAt?: Date;
}): Promise<void> {
  await getDb().collection('training_sessions').insertOne({
    userId,
    templateId: 'tmpl-1',
    sessionNumber: 1,
    ...patch,
  });
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_reminder_test');
  await ensureUserIndexes();
  await ensureDeviceTokenIndexes();
  await ensureTrainingIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('findUsersDueForWorkoutReminder', () => {
  const now = new Date('2026-08-27T00:00:00.000Z');

  it('includes a user with a token whose last completed session was 5 days ago', async () => {
    await upsertDeviceToken('user-due', 'tok-due');
    await insertSession('user-due', {
      status: SessionStatus.COMPLETED,
      startedAt: daysAgo(now, 5),
      finishedAt: daysAgo(now, 5),
    });

    const due = await findUsersDueForWorkoutReminder(now, 3);

    expect(due).toContain('user-due');
  });

  it('excludes a user who trained today', async () => {
    await upsertDeviceToken('user-recent', 'tok-recent');
    await insertSession('user-recent', {
      status: SessionStatus.COMPLETED,
      startedAt: now,
      finishedAt: now,
    });

    const due = await findUsersDueForWorkoutReminder(now, 3);

    expect(due).not.toContain('user-recent');
  });

  it('excludes a user with a token but no completed session', async () => {
    await upsertDeviceToken('user-no-session', 'tok-no-session');

    const due = await findUsersDueForWorkoutReminder(now, 3);

    expect(due).not.toContain('user-no-session');
  });

  it('falls back to startedAt when finishedAt is unset', async () => {
    await upsertDeviceToken('user-no-finish', 'tok-no-finish');
    await insertSession('user-no-finish', {
      status: SessionStatus.COMPLETED,
      startedAt: daysAgo(now, 10),
    });

    const due = await findUsersDueForWorkoutReminder(now, 3);

    expect(due).toContain('user-no-finish');
  });
});

describe('sendWorkoutReminders', () => {
  const now = new Date('2026-08-27T00:00:00.000Z');

  it('notifies the due user via the sender', async () => {
    await upsertByAuthId({ authId: 'user-notify', authProvider: AuthProvider.PASSWORD, isGuest: false });
    await upsertDeviceToken('user-notify', 'tok-notify');
    await insertSession('user-notify', {
      status: SessionStatus.COMPLETED,
      startedAt: daysAgo(now, 7),
      finishedAt: daysAgo(now, 7),
    });
    const sender = new FakePushSender();

    const result = await sendWorkoutReminders(now, { sender });

    expect(result.notified).toBeGreaterThanOrEqual(1);
    const call = sender.calls.find((c) => c.tokens.includes('tok-notify'));
    expect(call).toBeDefined();
  });
});
