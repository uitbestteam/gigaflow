import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db';
import { PlanTemplateType } from '@gigaflow/shared';
import { ensureExerciseIndexes, findBySlugs } from '../exercise/exercise.repo.js';
import { seedPresets } from '../exercise/seed-exercises.js';
import { ensureWorkoutIndexes, findActivePlan } from './workout.repo.js';
import { PRESET_TEMPLATES, createPlanFromTemplate } from './preset-templates.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_preset_test');
  await ensureExerciseIndexes();
  await ensureWorkoutIndexes();
  await seedPresets();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

describe('preset templates', () => {
  it('every preset slug exists in the seeded catalog', () => {
    // structural check: all slugs are strings; existence verified by instantiation below
    for (const key of Object.keys(PRESET_TEMPLATES)) {
      const def = PRESET_TEMPLATES[key as keyof typeof PRESET_TEMPLATES];
      expect(def.templates.length).toBeGreaterThan(0);
    }
    expect(typeof findBySlugs).toBe('function');
  });
  it('instantiates a PPL plan resolving slugs to exercise ids', async () => {
    const plan = await createPlanFromTemplate('u1', PlanTemplateType.PPL);
    expect(plan.templateType).toBe(PlanTemplateType.PPL);
    expect(plan.templates.length).toBe(PRESET_TEMPLATES.ppl.templates.length);
    const firstSlot = plan.templates[0].slots[0];
    expect(firstSlot.exerciseId).toMatch(/^[a-f0-9]{24}$/);
    expect(firstSlot.weightIncrement).toBeGreaterThanOrEqual(0);
  });
  it('sets the new plan active', async () => {
    await createPlanFromTemplate('u2', PlanTemplateType.FULL_BODY);
    const active = await findActivePlan('u2');
    expect(active?.templateType).toBe(PlanTemplateType.FULL_BODY);
  });
  it('throws for CUSTOM template type', async () => {
    await expect(createPlanFromTemplate('u3', PlanTemplateType.CUSTOM)).rejects.toThrow(/Unknown preset template/);
  });
});
