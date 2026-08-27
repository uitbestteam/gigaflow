import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { GenerationType, JobStatus } from '@gigaflow/shared';
import { ensureGenerationJobIndexes, createJob, setJobStatus } from '../workout/generation-job.repo.js';
import type { TaskEnqueuer } from '../workout/workout-gen.routes.js';
import { notifyingEnqueuer } from './notifying-enqueuer.js';
import type { PushSender, PushMessage } from './push-sender.js';

let mongod: MongoMemoryServer;

class FakePushSender implements PushSender {
  calls: { tokens: string[]; message: PushMessage }[] = [];
  send = async (tokens: string[], message: PushMessage): Promise<void> => {
    this.calls.push({ tokens, message });
  };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_notifying_enqueuer_test');
  await ensureGenerationJobIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('notifyingEnqueuer', () => {
  it('notifies job complete when the inner enqueuer succeeds and leaves the job DONE', async () => {
    const job = await createJob('user-done', GenerationType.WORKOUT, {});
    const inner: TaskEnqueuer = async (jobId) => {
      await setJobStatus(jobId, { status: JobStatus.DONE });
    };
    const sender = new FakePushSender();
    // Ensure a device token exists so the notification actually sends.
    const { upsertDeviceToken, ensureDeviceTokenIndexes } = await import('./device-token.repo.js');
    await ensureDeviceTokenIndexes();
    await upsertDeviceToken('user-done', 'tok-done');

    const wrapped = notifyingEnqueuer(inner, 'workout', { sender });
    await wrapped(job.id);

    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0]?.tokens).toEqual(['tok-done']);
  });

  it('notifies job error and rethrows when the inner enqueuer throws leaving the job FAILED', async () => {
    const job = await createJob('user-failed', GenerationType.WORKOUT, {});
    const innerError = new Error('generation blew up');
    const inner: TaskEnqueuer = async (jobId) => {
      await setJobStatus(jobId, { status: JobStatus.FAILED, error: innerError.message });
      throw innerError;
    };
    const sender = new FakePushSender();
    const { upsertDeviceToken } = await import('./device-token.repo.js');
    await upsertDeviceToken('user-failed', 'tok-failed');

    const wrapped = notifyingEnqueuer(inner, 'workout', { sender });

    await expect(wrapped(job.id)).rejects.toThrow('generation blew up');
    expect(sender.calls).toHaveLength(1);
    expect(sender.calls[0]?.tokens).toEqual(['tok-failed']);
  });

  it('does not throw when notification lookups fail (e.g. unknown job)', async () => {
    const inner: TaskEnqueuer = async () => {};
    const sender = new FakePushSender();
    const wrapped = notifyingEnqueuer(inner, 'workout', { sender });

    await expect(wrapped('not-a-real-id')).resolves.toBeUndefined();
    expect(sender.calls).toHaveLength(0);
  });
});
