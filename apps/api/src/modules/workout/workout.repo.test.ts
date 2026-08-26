import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import { ensureWorkoutIndexes, insertPlanGraph, findActivePlan } from './workout.repo.js';

let mongod: MongoMemoryServer;
beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_wo_test');
  await ensureWorkoutIndexes();
});
afterAll(async () => { await closeDb(); await mongod.stop(); });

const tpl = (order: number, tag: ColorTag) => ({
  name: { en: `T${order}`, vi: `T${order}` }, orderIndex: order, colorTag: tag,
  slots: [{ exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 }],
});

describe('WorkoutRepository', () => {
  it('inserts a plan graph and reads it back nested', async () => {
    const plan = await insertPlanGraph('u1', { name: 'PPL', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true }, [tpl(0, ColorTag.PUSH), tpl(1, ColorTag.PULL)]);
    expect(plan.id).toMatch(/^[a-f0-9]{24}$/);
    expect(plan.templates).toHaveLength(2);
    expect(plan.templates[0].slots).toHaveLength(1);
    expect(plan.templates[0].slots[0].exerciseId).toBe('e1');
  });
  it('findActivePlan returns the active plan sorted by orderIndex', async () => {
    const active = await findActivePlan('u1');
    expect(active).not.toBeNull();
    expect(active?.templates.map((t) => t.orderIndex)).toEqual([0, 1]);
  });
  it('creating a second active plan deactivates the first', async () => {
    await insertPlanGraph('u1', { name: 'UL', templateType: PlanTemplateType.UPPER_LOWER, source: PlanSource.CUSTOM, isActive: true }, [tpl(0, ColorTag.UPPER)]);
    const active = await findActivePlan('u1');
    expect(active?.name).toBe('UL');
  });
  it('returns null when the user has no active plan', async () => {
    expect(await findActivePlan('nobody')).toBeNull();
  });
});
