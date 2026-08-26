import { describe, it, expect } from 'vitest';
import {
  zPlan, zExerciseSlot, zPlanWithTemplates, PlanSource, PlanTemplateType, ColorTag, EquipmentType,
} from '../index';

const plan = { id: 'p1', userId: 'u1', name: 'PPL', templateType: PlanTemplateType.PPL, source: PlanSource.CUSTOM, isActive: true, createdAt: new Date() };
const slot = { id: 's1', templateId: 't1', exerciseId: 'e1', orderIndex: 0, setsTarget: 4, repRangeMin: 6, repRangeMax: 10, equipmentType: EquipmentType.BARBELL, weightIncrement: 2.5 };

describe('plan schemas', () => {
  it('accepts a valid plan', () => { expect(zPlan.safeParse(plan).success).toBe(true); });
  it('rejects an unknown templateType', () => { expect(zPlan.safeParse({ ...plan, templateType: 'bro-split' }).success).toBe(false); });
  it('accepts a valid slot', () => { expect(zExerciseSlot.safeParse(slot).success).toBe(true); });
  it('rejects setsTarget out of range', () => { expect(zExerciseSlot.safeParse({ ...slot, setsTarget: 99 }).success).toBe(false); });
  it('accepts a nested plan-with-templates', () => {
    const r = zPlanWithTemplates.safeParse({ ...plan, templates: [{ id: 't1', planId: 'p1', name: { en: 'Push A', vi: 'Đẩy A' }, orderIndex: 0, colorTag: ColorTag.PUSH, slots: [slot] }] });
    expect(r.success).toBe(true);
  });
});
