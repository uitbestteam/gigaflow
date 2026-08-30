import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, closeDb } from '../../lib/db.js';
import { ColorTag, EquipmentType, PlanSource, PlanTemplateType } from '@gigaflow/shared';
import {
  ensureWorkoutIndexes, insertPlanGraph, findActivePlan,
  listPlans, findPlanById, replacePlanGraph, deletePlan,
} from './workout.repo.js';

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

describe('listPlans', () => {
  it('returns the user plans newest first, excluding other users', async () => {
    const p1 = await insertPlanGraph('u2', { name: 'First', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    const p2 = await insertPlanGraph('u2', { name: 'Second', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    await insertPlanGraph('other-user', { name: 'NotMine', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);

    const result = await listPlans('u2');
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.id)).toEqual([p2.id, p1.id]);
    expect(result.every((p) => p.userId === 'u2')).toBe(true);
  });
});

describe('findPlanById', () => {
  it('returns the full graph for an owned plan', async () => {
    const created = await insertPlanGraph('u3', { name: 'Owned', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH), tpl(1, ColorTag.PULL)]);
    const found = await findPlanById('u3', created.id);
    expect(found).not.toBeNull();
    expect(found?.templates.map((t) => t.orderIndex)).toEqual([0, 1]);
    expect(found?.templates[0]?.slots).toHaveLength(1);
  });
  it('returns null for another user id or missing id', async () => {
    const created = await insertPlanGraph('u3', { name: 'Owned2', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    expect(await findPlanById('someone-else', created.id)).toBeNull();
    expect(await findPlanById('u3', '000000000000000000000000')).toBeNull();
  });
});

describe('replacePlanGraph', () => {
  it('replaces templates/slots and preserves createdAt/isActive/templateType by default', async () => {
    const seedTpl = {
      name: { en: 'Seed', vi: 'Seed' }, orderIndex: 0, colorTag: ColorTag.PUSH,
      slots: [
        { exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 },
        { exerciseId: 'e2', orderIndex: 1, setsTarget: 3, repRangeMin: 8, repRangeMax: 12, equipmentType: EquipmentType.DUMBBELL, weightIncrement: 1.25 },
      ],
    };
    const created = await insertPlanGraph('u4', { name: 'ReplaceMe', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true }, [seedTpl]);
    const oldSlotIds = created.templates[0]?.slots.map((s) => s.id) ?? [];
    expect(oldSlotIds).toHaveLength(2);

    const newTemplates = [tpl(0, ColorTag.PULL), tpl(1, ColorTag.LEGS)];
    const replaced = await replacePlanGraph('u4', created.id, { name: 'ReplacedName' }, newTemplates);
    expect(replaced).not.toBeNull();
    expect(replaced?.name).toBe('ReplacedName');
    expect(replaced?.isActive).toBe(true);
    expect(replaced?.templateType).toBe(PlanTemplateType.PPL);
    expect(replaced?.templates).toHaveLength(2);

    const refetched = await findPlanById('u4', created.id);
    expect(refetched?.templates).toHaveLength(2);
    const newSlotIds = refetched?.templates.flatMap((t) => t.slots.map((s) => s.id)) ?? [];
    for (const oldId of oldSlotIds) {
      expect(newSlotIds).not.toContain(oldId);
    }
  });
  it('returns null for a non-owned plan', async () => {
    const created = await insertPlanGraph('u5', { name: 'NotYours', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    const result = await replacePlanGraph('intruder', created.id, {}, [tpl(0, ColorTag.PULL)]);
    expect(result).toBeNull();
  });
});

describe('deletePlan', () => {
  it('cascades deletion of templates and slots, returns true', async () => {
    const created = await insertPlanGraph('u6', { name: 'ToDelete', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    const result = await deletePlan('u6', created.id);
    expect(result).toBe(true);
    expect(await findPlanById('u6', created.id)).toBeNull();
  });
  it('returns false for a non-owned or missing id', async () => {
    const created = await insertPlanGraph('u7', { name: 'Protected', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: false }, [tpl(0, ColorTag.PUSH)]);
    expect(await deletePlan('intruder', created.id)).toBe(false);
    expect(await deletePlan('u7', '000000000000000000000000')).toBe(false);
  });
});
