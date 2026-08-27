import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import {
  Goal, Gender, ActivityLevel, MealType, GenerationType, JobStatus,
  PLAN_LIMITS, SubscriptionPlan, type MealPlan,
} from '@gigaflow/shared';
import { ensureGenerationJobIndexes } from '../workout/generation-job.repo.js';
import { ensureMealPlanIndexes } from './meal-plan.repo.js';
import { incrementUsage } from '../subscription/quota.service.js';
import type { TokenVerifier } from '../auth/firebase-auth.js';
import { makeMealGenRoutes, inlineMealEnqueuer } from './meal-gen.routes.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_mealgen_routes_test');
  await ensureGenerationJobIndexes();
  await ensureMealPlanIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const verify: TokenVerifier = async (t) => (t === 'u1' || t === 'u2' ? { uid: t, signInProvider: 'anonymous' } : Promise.reject(new Error('bad')));
const H = { Authorization: 'Bearer u1', 'Content-Type': 'application/json' };

const validPlan: MealPlan = {
  name: 'AI Meal Plan',
  days: [
    {
      dayIndex: 1,
      meals: [
        {
          name: { en: 'Oats', vi: 'Yến mạch' },
          mealType: MealType.BREAKFAST,
          calories: 500,
          proteinG: 30,
          carbsG: 60,
          fatG: 15,
          ingredients: ['oats', 'milk'],
        },
      ],
      totalCalories: 500,
      totalProteinG: 30,
      totalCarbsG: 60,
      totalFatG: 15,
    },
  ],
};

const FAKE_ENGINE = { generateMealPlan: async () => validPlan };
const validBody = {
  goal: Goal.HYPERTROPHY,
  gender: Gender.MALE,
  age: 28,
  heightCm: 180,
  weightKg: 80,
  activityLevel: ActivityLevel.MODERATE,
};

function makeApp() {
  return makeMealGenRoutes({
    verify,
    engine: FAKE_ENGINE,
    enqueue: inlineMealEnqueuer({ engine: FAKE_ENGINE }),
  });
}

describe('meal-gen routes', () => {
  it('401 without token', async () => {
    const res = await makeApp().request('/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(validBody) });
    expect(res.status).toBe(401);
  });

  it('POST /generate → 202 + jobId, then GET /jobs/:id → done + resultId, then GET /active → the plan', async () => {
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

    const activeRes = await app.request('/active', { headers: { Authorization: 'Bearer u1' } });
    expect(activeRes.status).toBe(200);
    const activeBody = (await activeRes.json()) as { data: { name: string } | null };
    expect(activeBody.data?.name).toBe('AI Meal Plan');
  });

  it('POST /generate → 400 on invalid body', async () => {
    const res = await makeApp().request('/generate', { method: 'POST', headers: H, body: JSON.stringify({ goal: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('POST /generate → 429 once quota is exhausted', async () => {
    const limit = PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.MEAL];
    const app = makeApp();
    // establish the user via a real auth'd request, then exhaust quota directly
    await app.request('/jobs/000000000000000000000000', { headers: { Authorization: 'Bearer u2' } });
    for (let i = 0; i < limit; i++) await incrementUsage('u2', GenerationType.MEAL, new Date());

    const res = await app.request('/generate', {
      method: 'POST',
      headers: { Authorization: 'Bearer u2', 'Content-Type': 'application/json' },
      body: JSON.stringify(validBody),
    });
    expect(res.status).toBe(429);
  });
});
