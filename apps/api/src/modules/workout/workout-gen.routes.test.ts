import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import {
  ColorTag, ExperienceLevel, Goal, GenerationType, JobStatus,
  PLAN_LIMITS, SubscriptionPlan, type GeneratedPlan,
} from '@gigaflow/shared';
import { ensureExerciseIndexes } from '../exercise/exercise.repo.js';
import { seedPresets } from '../exercise/seed-exercises.js';
import { ensureWorkoutIndexes } from './workout.repo.js';
import { ensureGenerationJobIndexes } from './generation-job.repo.js';
import { incrementUsage } from '../subscription/quota.service.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import { makeWorkoutGenRoutes, makeInternalTaskRoutes, inlineEnqueuer } from './workout-gen.routes.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wogen_routes_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await ensureGenerationJobIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

const validPlan: GeneratedPlan = {
  name: 'AI Push Pull Legs',
  templates: [
    {
      name: { en: 'Push Day', vi: 'Ngày đẩy' },
      colorTag: ColorTag.PUSH,
      slots: [
        { exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 },
        { exerciseSlug: 'ohp-barbell', setsTarget: 3, repRangeMin: 8, repRangeMax: 12 },
      ],
    },
  ],
};

const FAKE_ENGINE = { generateWorkoutPlan: async () => validPlan };
const validBody = { goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 };

function makeApp() {
  return makeWorkoutGenRoutes({
    verify,
    engine: FAKE_ENGINE,
    enqueue: inlineEnqueuer({ engine: FAKE_ENGINE }),
  });
}

describe('workout-gen routes', () => {
  it('401 without token', async () => {
    const res = await makeApp().request('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) });
    expect(res.status).toBe(401);
  });

  it('POST /generate → 202 + jobId, then GET /jobs/:id → done + resultId', async () => {
    const app = makeApp();
    const res = await app.request('/generate', { method: 'POST', headers: H, body: JSON.stringify(validBody) });
    expect(res.status).toBe(202);
    const body = (await res.json()) as { success: boolean; data: { jobId: string } };
    expect(body.success).toBe(true);
    const jobId = body.data.jobId;

    const jobRes = await app.request(`/jobs/${jobId}`, { headers: { Authorization: 'Bearer u1' } });
    expect(jobRes.status).toBe(200);
    const jobBody = (await jobRes.json()) as { data: { status: string; resultId?: string } };
    expect(jobBody.data.status).toBe(JobStatus.DONE);
    expect(jobBody.data.resultId).toMatch(/^[a-f0-9]{24}$/);
  });

  it('POST /generate → 400 on invalid body', async () => {
    const res = await makeApp().request('/generate', { method: 'POST', headers: H, body: JSON.stringify({ goal: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('POST /generate → 429 once quota is exhausted', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT];
    const app = makeApp();
    // establish the user via a real auth'd request, then exhaust quota directly
    await app.request('/jobs/000000000000000000000000', { headers: { Authorization: 'Bearer u2' } });
    for (let i = 0; i < limit; i++) await incrementUsage('u2', GenerationType.WORKOUT, new Date());

    const res = await app.request('/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer u2', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(429);
  });

  it('internal POST /generate-workout with X-CloudTasks-QueueName processes a queued job', async () => {
    const genApp = makeWorkoutGenRoutes({
      verify,
      engine: FAKE_ENGINE,
      // no-op enqueuer: we want the job left QUEUED so the internal handler processes it
      enqueue: async () => Promise.resolve(),
    });
    const create = await genApp.request('/generate', { method: 'POST', headers: H, body: JSON.stringify(validBody) });
    const created = (await create.json()) as { data: { jobId: string } };
    const jobId = created.data.jobId;

    const internalApp = makeInternalTaskRoutes({ engine: FAKE_ENGINE });

    const unauthorized = await internalApp.request('/generate-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId }),
    });
    expect(unauthorized.status).toBe(401);

    const authorized = await internalApp.request('/generate-workout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CloudTasks-QueueName': 'q1' },
      body: JSON.stringify({ jobId }),
    });
    expect(authorized.status).toBe(200);

    const jobRes = await genApp.request(`/jobs/${jobId}`, { headers: { Authorization: 'Bearer u1' } });
    const jobBody = (await jobRes.json()) as { data: { status: string } };
    expect(jobBody.data.status).toBe(JobStatus.DONE);
  });
});
