import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb, getDb } from '../../lib/db.js';
import { GenerationType, JobStatus, Goal, Gender, ActivityLevel, MealType, type MealPlan } from '@gigaflow/shared';
import { ensureGenerationJobIndexes, createJob, findJobForUser } from '../workout/generation-job.repo.js';
import { ensureMealPlanIndexes, findActiveMealPlan } from './meal-plan.repo.js';
import { incrementUsage, checkQuota } from '../subscription/quota.service.js';
import { processGenerateMeal, type MealGenDeps } from './meal-generation.service.js';

let mongod: MongoMemoryServer;
const NOW = new Date('2026-08-26T00:00:00Z');

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_mealgen_test');
  await ensureMealPlanIndexes();
  await ensureGenerationJobIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });
beforeEach(async () => { await getDb().collection('users').deleteMany({}); });

async function makeUser(authId: string) {
  await getDb().collection('users').insertOne({
    authId, authSource: 'firebase', authProvider: 'anonymous', isGuest: true,
    timezone: 'Asia/Ho_Chi_Minh', language: 'en', createdAt: NOW, updatedAt: NOW,
  });
}

const validInput = {
  goal: Goal.HYPERTROPHY,
  gender: Gender.MALE,
  age: 28,
  heightCm: 180,
  weightKg: 80,
  activityLevel: ActivityLevel.MODERATE,
};

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

describe('meal-generation.service', () => {
  it('processes a job end-to-end: job done + resultId + active meal plan created', async () => {
    await makeUser('meal-u1');
    await incrementUsage('meal-u1', GenerationType.MEAL, NOW);

    const job = await createJob('meal-u1', GenerationType.MEAL, validInput);

    const deps: MealGenDeps = { engine: { generateMealPlan: async () => validPlan } };
    await processGenerateMeal(job.id, deps);

    const found = await findJobForUser('meal-u1', job.id);
    expect(found?.status).toBe(JobStatus.DONE);
    expect(found?.resultId).toMatch(/^[a-f0-9]{24}$/);

    const activePlan = await findActiveMealPlan('meal-u1');
    expect(activePlan).not.toBeNull();
    expect(activePlan?.name).toBe('AI Meal Plan');
    expect(activePlan?.days).toHaveLength(1);
  });

  it('marks the job failed and rolls back quota when the engine throws', async () => {
    await makeUser('meal-u2');
    await incrementUsage('meal-u2', GenerationType.MEAL, NOW);
    const before = await checkQuota('meal-u2', GenerationType.MEAL, NOW);
    expect(before.used).toBe(1);

    const job = await createJob('meal-u2', GenerationType.MEAL, validInput);

    const deps: MealGenDeps = {
      engine: { generateMealPlan: async () => { throw new Error('provider unavailable'); } },
    };
    await expect(processGenerateMeal(job.id, deps)).rejects.toThrow('provider unavailable');

    const found = await findJobForUser('meal-u2', job.id);
    expect(found?.status).toBe(JobStatus.FAILED);
    expect(found?.error).toBe('provider unavailable');

    const after = await checkQuota('meal-u2', GenerationType.MEAL, NOW);
    expect(after.used).toBe(0);
  });

  it('throws when the job does not exist', async () => {
    const deps: MealGenDeps = { engine: { generateMealPlan: async () => validPlan } };
    await expect(processGenerateMeal('000000000000000000000000', deps)).rejects.toThrow();
  });
});
