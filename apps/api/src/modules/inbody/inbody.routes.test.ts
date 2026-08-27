import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import {
  GenerationType, ImageMimeType, JobStatus, PLAN_LIMITS, SubscriptionPlan,
} from '@gigaflow/shared';
import { ensureGenerationJobIndexes } from '../workout/generation-job.repo.js';
import { incrementUsage } from '../subscription/quota.service.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import type { VisionAnalyzer } from './vision.js';
import { ensureInbodyIndexes } from './inbody.repo.js';
import { makeInbodyRoutes, inlineInbodyEnqueuer } from './inbody.routes.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_inbody_routes_test');
  await ensureGenerationJobIndexes();
  await ensureInbodyIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

const FAKE_METRICS = {
  weightKg: 70.5,
  bmi: 22.1,
  bodyFatPercent: 15.2,
  skeletalMuscleMassKg: 32.4,
  bodyFatMassKg: 10.7,
  visceralFatLevel: 5,
};

const FAKE_ANALYZER: VisionAnalyzer = {
  analyze: async () => FAKE_METRICS,
};

const validBody = { imageBase64: 'ZmFrZS1pbWFnZS1kYXRh', mimeType: ImageMimeType.JPEG };

function makeApp() {
  return makeInbodyRoutes({
    verify,
    analyzer: FAKE_ANALYZER,
    enqueue: inlineInbodyEnqueuer({ analyzer: FAKE_ANALYZER }),
  });
}

describe('inbody routes', () => {
  it('401 without token', async () => {
    const res = await makeApp().request('/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(401);
  });

  it('POST /analyze → 202 + jobId, then GET /jobs/:id → done + resultId, then GET /latest → metrics', async () => {
    const app = makeApp();
    const res = await app.request('/analyze', { method: 'POST', headers: H, body: JSON.stringify(validBody) });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { success: boolean; data: { jobId: string } };
    expect(body.success).toBe(true);
    const jobId = body.data.jobId;

    const jobRes = await app.request(`/jobs/${jobId}`, { headers: { Authorization: 'Bearer u1' } });
    expect(jobRes.status).toBe(200);
    const jobBody = (await jobRes.json()) as { data: { status: string; resultId?: string } };
    expect(jobBody.data.status).toBe(JobStatus.DONE);
    expect(jobBody.data.resultId).toMatch(/^[a-f0-9]{24}$/);

    const latestRes = await app.request('/latest', { headers: { Authorization: 'Bearer u1' } });
    expect(latestRes.status).toBe(200);
    const latestBody = (await latestRes.json()) as { data: { metrics: typeof FAKE_METRICS } | null };
    expect(latestBody.data).not.toBeNull();
    expect(latestBody.data?.metrics).toEqual(FAKE_METRICS);
  });

  it('POST /analyze → 400 on invalid body (bad mimeType)', async () => {
    const res = await makeApp().request('/analyze', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ imageBase64: 'ZmFrZQ==', mimeType: 'image/gif' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /analyze → 429 once quota is exhausted', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.INBODY];
    const app = makeApp();
    // establish the user via a real auth'd request, then exhaust quota directly
    await app.request('/jobs/000000000000000000000000', { headers: { Authorization: 'Bearer u2' } });
    for (let i = 0; i < limit; i++) await incrementUsage('u2', GenerationType.INBODY, new Date());

    const res = await app.request('/analyze', {
      method: 'POST',
      headers: { Authorization: 'Bearer u2', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(429);
  });
});
