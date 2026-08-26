import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { GenerationType, JobStatus } from '@gigaflow/shared';
import {
  ensureGenerationJobIndexes, createJob, setJobStatus, findJobForUser, findJobById,
} from './generation-job.repo.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_genjob_test');
  await ensureGenerationJobIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('generation-job.repo', () => {
  it('creates a job in QUEUED status', async () => {
    const job = await createJob('u1', GenerationType.WORKOUT, { goal: 'strength' });
    expect(job.id).toMatch(/^[a-f0-9]{24}$/);
    expect(job.userId).toBe('u1');
    expect(job.type).toBe(GenerationType.WORKOUT);
    expect(job.status).toBe(JobStatus.QUEUED);
    expect(job.input).toEqual({ goal: 'strength' });
  });

  it('setJobStatus updates status, resultId and error, omitting nullish fields', async () => {
    const job = await createJob('u2', GenerationType.WORKOUT, {});
    await setJobStatus(job.id, { status: JobStatus.PROCESSING });
    let found = await findJobForUser('u2', job.id);
    expect(found?.status).toBe(JobStatus.PROCESSING);
    expect(found?.resultId).toBeUndefined();
    expect(found?.error).toBeUndefined();

    await setJobStatus(job.id, { status: JobStatus.DONE, resultId: 'plan-123' });
    found = await findJobForUser('u2', job.id);
    expect(found?.status).toBe(JobStatus.DONE);
    expect(found?.resultId).toBe('plan-123');
    expect(found?.error).toBeUndefined();

    await setJobStatus(job.id, { status: JobStatus.FAILED, error: 'boom' });
    found = await findJobForUser('u2', job.id);
    expect(found?.status).toBe(JobStatus.FAILED);
    expect(found?.error).toBe('boom');
  });

  it('findJobForUser is owner-scoped', async () => {
    const job = await createJob('owner', GenerationType.WORKOUT, {});
    expect(await findJobForUser('someone-else', job.id)).toBeNull();
    expect(await findJobForUser('owner', job.id)).not.toBeNull();
  });

  it('findJobForUser returns null for an invalid hex id', async () => {
    expect(await findJobForUser('u1', 'not-a-valid-id')).toBeNull();
  });

  it('findJobById loads a job regardless of owner', async () => {
    const job = await createJob('u3', GenerationType.WORKOUT, {});
    const found = await findJobById(job.id);
    expect(found?.id).toBe(job.id);
    expect(await findJobById('not-a-valid-id')).toBeNull();
  });
});
