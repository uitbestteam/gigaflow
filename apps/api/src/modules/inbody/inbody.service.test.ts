import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { GenerationType, ImageMimeType, JobStatus } from '@gigaflow/shared';
import { ensureGenerationJobIndexes, createJob, findJobForUser } from '../workout/generation-job.repo.js';
import { incrementUsage, checkQuota } from '../subscription/quota.service.js';
import { ensureInbodyIndexes, findLatestInbody } from './inbody.repo.js';
import type { VisionAnalyzer } from './vision.js';
import { processAnalyzeInbody, type InbodyDeps } from './inbody.service.js';

let mongod: MongoMemoryServer;
const NOW = new Date('2026-08-26T00:00:00Z');

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_inbody_svc_test');
  await ensureGenerationJobIndexes();
  await ensureInbodyIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });
beforeEach(async () => { await getDb().collection('users').deleteMany({}); });

async function makeUser(authId: string) {
  await getDb().collection('users').insertOne({
    authId, authSource: 'firebase', authProvider: 'anonymous', isGuest: true,
    timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW,
  });
}

const validInput = { imageBase64: 'ZmFrZS1pbWFnZS1kYXRh', mimeType: ImageMimeType.JPEG };

const fakeAnalyzer: VisionAnalyzer = {
  analyze: async () => ({
    weightKg: 70.5,
    bmi: 22.1,
    bodyFatPercent: 15.2,
    skeletalMuscleMassKg: 32.4,
    bodyFatMassKg: 10.7,
    visceralFatLevel: 5,
  }),
};

const throwingAnalyzer: VisionAnalyzer = {
  analyze: async () => { throw new Error('vision provider unavailable'); },
};

describe('inbody.service', () => {
  it('processes a job end-to-end: job done + resultId + findLatestInbody returns metrics', async () => {
    await makeUser('inbody-u1');
    await incrementUsage('inbody-u1', GenerationType.INBODY, NOW);

    const job = await createJob('inbody-u1', GenerationType.INBODY, validInput);

    const deps: InbodyDeps = { analyzer: fakeAnalyzer };
    await processAnalyzeInbody(job.id, deps);

    const found = await findJobForUser('inbody-u1', job.id);
    expect(found?.status).toBe(JobStatus.DONE);
    expect(found?.resultId).toMatch(/^[a-f0-9]{24}$/);

    const latest = await findLatestInbody('inbody-u1');
    expect(latest).not.toBeNull();
    expect(latest?.id).toBe(found?.resultId);
    expect(latest?.metrics).toEqual({
      weightKg: 70.5,
      bmi: 22.1,
      bodyFatPercent: 15.2,
      skeletalMuscleMassKg: 32.4,
      bodyFatMassKg: 10.7,
      visceralFatLevel: 5,
    });
  });

  it('marks the job failed and rolls back quota when the analyzer throws', async () => {
    await makeUser('inbody-u2');
    await incrementUsage('inbody-u2', GenerationType.INBODY, NOW);
    const before = await checkQuota('inbody-u2', GenerationType.INBODY, NOW);
    expect(before.used).toBe(1);

    const job = await createJob('inbody-u2', GenerationType.INBODY, validInput);

    const deps: InbodyDeps = { analyzer: throwingAnalyzer };
    await expect(processAnalyzeInbody(job.id, deps)).rejects.toThrow('vision provider unavailable');

    const found = await findJobForUser('inbody-u2', job.id);
    expect(found?.status).toBe(JobStatus.FAILED);
    expect(found?.error).toBe('vision provider unavailable');

    const after = await checkQuota('inbody-u2', GenerationType.INBODY, NOW);
    expect(after.used).toBe(0);
  });

  it('throws when the job does not exist', async () => {
    const deps: InbodyDeps = { analyzer: fakeAnalyzer };
    await expect(processAnalyzeInbody('000000000000000000000000', deps)).rejects.toThrow();
  });
});
