import { describe, it, expect, beforeEach } from 'vitest';
import type { Exercise, PlanWithTemplates } from '@gigaflow/shared';
import { ColorTag, EquipmentType, MuscleGroup, PlanSource, PlanTemplateType, zCreatePlanInput } from '@gigaflow/shared';
import { usePlanBuilderStore } from './planBuilderStore';

const exercise: Exercise = {
  id: 'ex_1',
  slug: 'bench-barbell',
  name: { en: 'Bench press', vi: 'Đẩy ngực' },
  muscleGroup: MuscleGroup.CHEST,
  equipmentType: EquipmentType.BARBELL,
  defaultIncrement: 2.5,
  isCustom: false,
};

const exerciseNoIncrement: Exercise = {
  ...exercise,
  id: 'ex_2',
  defaultIncrement: 0,
};

const planFixture: PlanWithTemplates = {
  id: 'plan_1',
  userId: 'user_1',
  name: 'PPL Plan',
  templateType: PlanTemplateType.PPL,
  source: PlanSource.CUSTOM,
  isActive: true,
  createdAt: new Date(),
  templates: [
    {
      id: 'tmpl_1',
      planId: 'plan_1',
      name: { en: 'Push A', vi: 'Đẩy A' },
      focus: { en: 'Chest', vi: 'Ngực' },
      orderIndex: 0,
      colorTag: ColorTag.PUSH,
      slots: [
        {
          id: 'slot_1',
          templateId: 'tmpl_1',
          exerciseId: 'ex_1',
          orderIndex: 0,
          setsTarget: 4,
          repRangeMin: 6,
          repRangeMax: 10,
          equipmentType: EquipmentType.BARBELL,
          weightIncrement: 2.5,
        },
      ],
    },
    {
      id: 'tmpl_2',
      planId: 'plan_1',
      name: { en: 'Pull A', vi: 'Kéo A' },
      orderIndex: 1,
      colorTag: ColorTag.PULL,
      slots: [],
    },
  ],
};

describe('planBuilderStore', () => {
  beforeEach(() => {
    usePlanBuilderStore.getState().reset();
  });

  it('init() with no arg produces a blank plan with one empty starter template', () => {
    usePlanBuilderStore.getState().init();
    const state = usePlanBuilderStore.getState();
    expect(state.name).toBe('');
    expect(state.templateType).toBe(PlanTemplateType.CUSTOM);
    expect(state.templates).toHaveLength(1);
    expect(state.templates[0]).toMatchObject({ colorTag: ColorTag.CUSTOM, slots: [] });
  });

  it('init(fromPlan) maps plan templates and slots into editable copies', () => {
    usePlanBuilderStore.getState().init(planFixture);
    const state = usePlanBuilderStore.getState();
    expect(state.name).toBe('PPL Plan');
    expect(state.templateType).toBe(PlanTemplateType.PPL);
    expect(state.templates).toHaveLength(2);
    expect(state.templates[0]).toMatchObject({
      name: { en: 'Push A', vi: 'Đẩy A' },
      focus: { en: 'Chest', vi: 'Ngực' },
      colorTag: ColorTag.PUSH,
    });
    expect(state.templates[0]?.slots).toEqual([
      {
        exerciseId: 'ex_1',
        setsTarget: 4,
        repRangeMin: 6,
        repRangeMax: 10,
        equipmentType: EquipmentType.BARBELL,
        weightIncrement: 2.5,
      },
    ]);
    expect(state.templates[1]?.slots).toEqual([]);
  });

  it('addSlot appends a slot seeded with defaults from the exercise', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exercise);
    const slots = usePlanBuilderStore.getState().templates[0]?.slots;
    expect(slots).toEqual([
      {
        exerciseId: 'ex_1',
        setsTarget: 3,
        repRangeMin: 8,
        repRangeMax: 12,
        equipmentType: EquipmentType.BARBELL,
        weightIncrement: 2.5,
      },
    ]);
  });

  it('addSlot preserves a zero defaultIncrement (nullish coalescing, not falsy fallback)', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exerciseNoIncrement);
    const slot = usePlanBuilderStore.getState().templates[0]?.slots[0];
    expect(slot?.weightIncrement).toBe(0);
  });

  it('updateSlot changes only the targeted field', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exercise);
    usePlanBuilderStore.getState().updateSlot(0, 0, { setsTarget: 4 });
    const slot = usePlanBuilderStore.getState().templates[0]?.slots[0];
    expect(slot).toMatchObject({ setsTarget: 4, repRangeMin: 8, repRangeMax: 12, exerciseId: 'ex_1' });
  });

  it('removeSlot removes the targeted slot', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exercise);
    usePlanBuilderStore.getState().addSlot(0, exerciseNoIncrement);
    usePlanBuilderStore.getState().removeSlot(0, 0);
    const slots = usePlanBuilderStore.getState().templates[0]?.slots;
    expect(slots).toHaveLength(1);
    expect(slots?.[0]?.exerciseId).toBe('ex_2');
  });

  it('moveSlot up swaps the slot with the previous one', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exercise);
    usePlanBuilderStore.getState().addSlot(0, exerciseNoIncrement);
    usePlanBuilderStore.getState().moveSlot(0, 1, 'up');
    const slots = usePlanBuilderStore.getState().templates[0]?.slots;
    expect(slots?.[0]?.exerciseId).toBe('ex_2');
    expect(slots?.[1]?.exerciseId).toBe('ex_1');
  });

  it('moveSlot is a no-op at bounds', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addSlot(0, exercise);
    usePlanBuilderStore.getState().moveSlot(0, 0, 'up');
    let slots = usePlanBuilderStore.getState().templates[0]?.slots;
    expect(slots?.[0]?.exerciseId).toBe('ex_1');

    usePlanBuilderStore.getState().moveSlot(0, 0, 'down');
    slots = usePlanBuilderStore.getState().templates[0]?.slots;
    expect(slots?.[0]?.exerciseId).toBe('ex_1');
  });

  it('addTemplate appends a blank template and removeTemplate removes it', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().addTemplate();
    expect(usePlanBuilderStore.getState().templates).toHaveLength(2);
    usePlanBuilderStore.getState().removeTemplate(0);
    expect(usePlanBuilderStore.getState().templates).toHaveLength(1);
  });

  it('setTemplateMeta patches only the given fields', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().setTemplateMeta(0, { colorTag: ColorTag.LEGS });
    const tmpl = usePlanBuilderStore.getState().templates[0];
    expect(tmpl?.colorTag).toBe(ColorTag.LEGS);
    expect(tmpl?.name).toEqual({ en: '', vi: '' });
  });

  it('moveTemplate up swaps templates and no-ops at bounds', () => {
    usePlanBuilderStore.getState().init(planFixture);
    usePlanBuilderStore.getState().moveTemplate(1, 'up');
    let templates = usePlanBuilderStore.getState().templates;
    expect(templates[0]?.name).toEqual({ en: 'Pull A', vi: 'Kéo A' });
    expect(templates[1]?.name).toEqual({ en: 'Push A', vi: 'Đẩy A' });

    usePlanBuilderStore.getState().moveTemplate(0, 'up');
    templates = usePlanBuilderStore.getState().templates;
    expect(templates[0]?.name).toEqual({ en: 'Pull A', vi: 'Kéo A' });
  });

  it('setName updates the plan name', () => {
    usePlanBuilderStore.getState().init();
    usePlanBuilderStore.getState().setName('My Plan');
    expect(usePlanBuilderStore.getState().name).toBe('My Plan');
  });

  it('toInput() maps editable state into a valid CreatePlanInput with contiguous orderIndex', () => {
    usePlanBuilderStore.getState().init(planFixture);
    usePlanBuilderStore.getState().setName('Edited Plan');
    usePlanBuilderStore.getState().addSlot(0, exercise);
    usePlanBuilderStore.getState().updateSlot(0, 1, { setsTarget: 5 });

    const input = usePlanBuilderStore.getState().toInput();
    const parsed = zCreatePlanInput.parse(input);

    expect(parsed.name).toBe('Edited Plan');
    expect(parsed.templateType).toBe(PlanTemplateType.PPL);
    expect(parsed.templates).toHaveLength(2);
    expect(parsed.templates[0]?.orderIndex).toBe(0);
    expect(parsed.templates[1]?.orderIndex).toBe(1);
    expect(parsed.templates[0]?.slots[0]?.orderIndex).toBe(0);
    expect(parsed.templates[0]?.slots[1]?.orderIndex).toBe(1);
    expect(parsed.templates[0]?.slots[1]?.setsTarget).toBe(5);
  });

  it('reset() clears back to empty templates array', () => {
    usePlanBuilderStore.getState().init(planFixture);
    usePlanBuilderStore.getState().reset();
    const state = usePlanBuilderStore.getState();
    expect(state.name).toBe('');
    expect(state.templates).toEqual([]);
  });
});
