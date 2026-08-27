import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { MealType, type MealPlan } from '@gigaflow/shared';
import { ensureMealPlanIndexes, createMealPlan, findActiveMealPlan, findMealPlanForUser } from './meal-plan.repo.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_meal_test');
  await ensureMealPlanIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const plan = (name: string): MealPlan => ({
  name,
  days: [
    {
      dayIndex: 1,
      meals: [
        {
          name: { en: 'Oats', vi: 'Yến mạch' },
          mealType: MealType.BREAKFAST,
          calories: 400,
          proteinG: 20,
          carbsG: 60,
          fatG: 10,
          ingredients: ['oats', 'milk'],
        },
      ],
      totalCalories: 400,
      totalProteinG: 20,
      totalCarbsG: 60,
      totalFatG: 10,
    },
  ],
});

describe('meal-plan.repo', () => {
  it('creates a meal plan as active', async () => {
    const doc = await createMealPlan('u1', plan('Plan A'));
    expect(doc.id).toMatch(/^[a-f0-9]{24}$/);
    expect(doc.userId).toBe('u1');
    expect(doc.isActive).toBe(true);
    expect(doc.name).toBe('Plan A');
    expect(doc.createdAt).toBeInstanceOf(Date);
  });

  it('deactivates prior plans when creating a new active one', async () => {
    await createMealPlan('u2', plan('First'));
    const second = await createMealPlan('u2', plan('Second'));
    const active = await findActiveMealPlan('u2');
    expect(active?.id).toBe(second.id);
    expect(active?.name).toBe('Second');
  });

  it('findActiveMealPlan returns null when the user has no active plan', async () => {
    expect(await findActiveMealPlan('nobody')).toBeNull();
  });

  it('findMealPlanForUser is owner-scoped', async () => {
    const doc = await createMealPlan('owner', plan('Owned'));
    expect(await findMealPlanForUser('someone-else', doc.id)).toBeNull();
    const found = await findMealPlanForUser('owner', doc.id);
    expect(found?.id).toBe(doc.id);
  });

  it('findMealPlanForUser returns null for an invalid hex id', async () => {
    expect(await findMealPlanForUser('owner', 'not-a-valid-id')).toBeNull();
  });
});
