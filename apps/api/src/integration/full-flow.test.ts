import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Hono } from 'hono';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../lib/db.js';
import {
  ColorTag, ExperienceLevel, Goal, JobStatus, type GeneratedPlan, type LogSetInput,
} from '@gigaflow/shared';
import { ensureUserIndexes } from '../modules/auth/user.repo.js';
import { ensureExerciseIndexes } from '../modules/exercise/exercise.repo.js';
import { seedPresets } from '../modules/exercise/seed-exercises.js';
import { ensureWorkoutIndexes } from '../modules/workout/workout.repo.js';
import { ensureGenerationJobIndexes } from '../modules/workout/generation-job.repo.js';
import { ensureTrainingIndexes } from '../modules/training/session.repo.js';
import { ensureInbodyIndexes } from '../modules/inbody/inbody.repo.js';
import { ensureDeviceTokenIndexes } from '../modules/notification/device-token.repo.js';
import { ensureMealPlanIndexes } from '../modules/nutrition/meal-plan.repo.js';
import { ensureWeightIndexes } from '../modules/weight/weight.repo.js';
import type { TokenVerifier } from '../modules/auth/firebase-auth.js';
import { makeAuthRoutes } from '../modules/auth/auth.routes.js';
import { makeExerciseRoutes } from '../modules/exercise/exercise.routes.js';
import { makeWorkoutRoutes } from '../modules/workout/workout.routes.js';
import { makeWorkoutGenRoutes, inlineEnqueuer } from '../modules/workout/workout-gen.routes.js';
import { makeSessionRoutes, makeLastPerfRoutes } from '../modules/training/session.routes.js';
import { makeStatsRoutes } from '../modules/stats/stats.routes.js';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_full_flow_test');
  await ensureUserIndexes();
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await ensureGenerationJobIndexes();
  await ensureTrainingIndexes();
  await ensureInbodyIndexes();
  await ensureDeviceTokenIndexes();
  await ensureMealPlanIndexes();
  await ensureWeightIndexes();
  await seedPresets();
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

// Fake verifier: fixed anonymous user for every request carrying "Bearer u1".
const verify: TokenVerifier = async (t) =>
  t === 'u1' ? { uid: 'u1', signInProvider: 'anonymous' } : Promise.reject(new Error('bad'));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

// Fake AI engine: returns a fixed, valid plan over slugs seeded by seedPresets().
const AI_PLAN: GeneratedPlan = {
  name: 'AI Push Pull Legs',
  templates: [
    {
      name: { en: 'Push Day', vi: 'Ngày đẩy' },
      colorTag: ColorTag.PUSH,
      slots: [
        { exerciseSlug: 'bench-barbell', setsTarget: 3, repRangeMin: 6, repRangeMax: 10 },
        { exerciseSlug: 'ohp-barbell', setsTarget: 3, repRangeMin: 8, repRangeMax: 12 },
      ],
    },
  ],
};
const FAKE_ENGINE = { generateWorkoutPlan: async () => AI_PLAN };

// Mirrors how app.ts's createApp mounts modules under /api, but with injected fakes
// (fake verifier + fake AI engine + inline enqueuer) instead of firebaseVerifier/buildAiEngine.
function buildTestApp(): Hono {
  const app = new Hono().basePath('/api');
  app.route('/auth', makeAuthRoutes({ verify }));
  app.route('/exercises', makeExerciseRoutes({ verify }));
  app.route('/plans', makeWorkoutRoutes({ verify }));
  app.route('/sessions', makeSessionRoutes({ verify }));
  app.route('/exercises', makeLastPerfRoutes({ verify }));
  app.route('/workout', makeWorkoutGenRoutes({
    verify,
    engine: FAKE_ENGINE,
    enqueue: inlineEnqueuer({ engine: FAKE_ENGINE }),
  }));
  app.route('/stats', makeStatsRoutes({ verify }));
  return app;
}

interface Slot {
  id: string; exerciseId: string; repRangeMax: number; weightIncrement: number; weightSuggested: number;
}
interface Template { id: string; slots: Slot[] }

describe('full-flow integration: generate → session → progression → PR', () => {
  it('walks the whole journey end to end', async () => {
    const app = buildTestApp();

    // 1. POST /auth/session (guest) — establishes/echoes the anonymous user.
    const sessionRes = await app.request('/api/auth/session', { method: 'POST', headers: H });
    expect(sessionRes.status).toBe(200);
    const sessionBody = (await sessionRes.json()) as { data: { authId: string } };
    expect(sessionBody.data.authId).toBe('u1');

    // 2. POST /workout/generate → 202 { jobId }
    const genRes = await app.request('/api/workout/generate', {
      method: 'POST',
      headers: H,
      body: JSON.stringify({ goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 }),
    });
    expect(genRes.status).toBe(202);
    const genBody = (await genRes.json()) as { data: { jobId: string } };
    const jobId = genBody.data.jobId;
    expect(jobId).toMatch(/^[a-f0-9]{24}$/);

    // 3. GET /workout/jobs/:id → done + resultId
    const jobRes = await app.request(`/api/workout/jobs/${jobId}`, { headers: { Authorization: 'Bearer u1' } });
    expect(jobRes.status).toBe(200);
    const jobBody = (await jobRes.json()) as { data: { status: string; resultId?: string } };
    expect(jobBody.data.status).toBe(JobStatus.DONE);
    expect(jobBody.data.resultId).toMatch(/^[a-f0-9]{24}$/);

    // 4. GET /plans/active → the AI plan (templates + slots)
    const activeRes = await app.request('/api/plans/active', { headers: { Authorization: 'Bearer u1' } });
    expect(activeRes.status).toBe(200);
    const activeBody = (await activeRes.json()) as { data: { id: string; templates: Template[] } };
    expect(activeBody.data.id).toBe(jobBody.data.resultId);
    const template = activeBody.data.templates[0];
    if (!template) throw new Error('expected a generated template');
    expect(template.slots.length).toBe(2);

    // 5. POST /sessions/start { templateId } → prefilled slots (fresh: weightSuggested 0)
    const startRes = await app.request('/api/sessions/start', {
      method: 'POST', headers: H, body: JSON.stringify({ templateId: template.id }),
    });
    expect(startRes.status).toBe(201);
    const startBody = (await startRes.json()) as { data: { session: { id: string }; slots: Slot[] } };
    const sessionId = startBody.data.session.id;
    expect(startBody.data.slots.length).toBe(2);
    expect(startBody.data.slots[0]?.weightSuggested).toBe(0);

    // 6. POST /sessions/:id/sets — log all sets hitting repRangeMax for every slot.
    const startingWeight = 40;
    const sets: LogSetInput[] = startBody.data.slots.map((slot, i) => ({
      slotId: slot.id,
      exerciseId: slot.exerciseId,
      setNumber: 1,
      weightKg: startingWeight + i,
      repsDone: slot.repRangeMax,
      weightSuggested: slot.weightSuggested,
      repsSuggested: slot.repRangeMax,
      isCompleted: true,
    }));
    const logRes = await app.request(`/api/sessions/${sessionId}/sets`, {
      method: 'POST', headers: H, body: JSON.stringify({ sets }),
    });
    expect(logRes.status).toBe(200);

    // 7. POST /sessions/:id/finish → 200
    const finishRes = await app.request(`/api/sessions/${sessionId}/finish`, { method: 'POST', headers: H });
    expect(finishRes.status).toBe(200);
    const finishBody = (await finishRes.json()) as { data: { status: string } };
    expect(finishBody.data.status).toBe('completed');

    // 8. POST /sessions/start again → the same template now suggests an increased weight.
    const restartRes = await app.request('/api/sessions/start', {
      method: 'POST', headers: H, body: JSON.stringify({ templateId: template.id }),
    });
    expect(restartRes.status).toBe(201);
    const restartBody = (await restartRes.json()) as { data: { slots: Slot[] } };
    const firstSlot = restartBody.data.slots[0];
    if (!firstSlot) throw new Error('expected a slot');
    expect(firstSlot.weightSuggested).toBe(startingWeight + firstSlot.weightIncrement);
    expect(firstSlot.weightSuggested).toBeGreaterThan(startingWeight);

    // 9. GET /stats/prs → a PR is present.
    const prsRes = await app.request('/api/stats/prs', { headers: { Authorization: 'Bearer u1' } });
    expect(prsRes.status).toBe(200);
    const prsBody = (await prsRes.json()) as { data: Array<{ exerciseId: string; bestSet: { e1RM: number } }> };
    expect(prsBody.data.length).toBeGreaterThan(0);
    expect(prsBody.data.some((pr) => pr.exerciseId === firstSlot.exerciseId && pr.bestSet.e1RM > 0)).toBe(true);
  });
});
