import { describe, it, expect, beforeEach } from 'vitest';
import { MuscleGroup, EquipmentType, PlanTemplateType, PlanSource, ColorTag, type CreatePlanInput } from '@gigaflow/shared';
import {
  configureApi,
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  activatePlan,
  deletePlan,
  createExercise,
  getExercises,
} from './api';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

beforeEach(() => {
  configureApi({ getToken: () => 'tok', onUnauthorized: async () => {}, baseUrl: '/api' });
});

const makePlanWithTemplates = () => ({
  id: 'plan-1',
  userId: 'user-1',
  name: 'My Plan',
  templateType: PlanTemplateType.CUSTOM,
  source: PlanSource.CUSTOM,
  isActive: false,
  createdAt: new Date('2026-01-15T10:30:00.000Z').toISOString(),
  templates: [
    {
      id: 'tmpl-1',
      planId: 'plan-1',
      name: { en: 'Push Day', vi: 'Ngày đẩy' },
      orderIndex: 0,
      colorTag: ColorTag.PUSH,
      slots: [
        {
          id: 'slot-1',
          templateId: 'tmpl-1',
          exerciseId: 'ex-1',
          orderIndex: 0,
          setsTarget: 3,
          repRangeMin: 8,
          repRangeMax: 12,
          equipmentType: EquipmentType.BARBELL,
          weightIncrement: 2.5,
        },
      ],
    },
  ],
});

const minimalCreateInput: CreatePlanInput = {
  name: 'My Plan',
  templateType: PlanTemplateType.CUSTOM,
  templates: [
    {
      name: { en: 'Push Day', vi: 'Ngày đẩy' },
      orderIndex: 0,
      colorTag: ColorTag.PUSH,
      slots: [
        {
          exerciseId: 'ex-1',
          orderIndex: 0,
          setsTarget: 3,
          repRangeMin: 8,
          repRangeMax: 12,
          equipmentType: EquipmentType.BARBELL,
          weightIncrement: 2.5,
        },
      ],
    },
  ],
};

describe('plans + exercises api helpers', () => {
  it('getExercises appends q and muscleGroup query params', async () => {
    let url = '';
    const fetchImpl = (async (input: RequestInfo) => {
      url = new Request(input).url;
      return ok([]);
    }) as typeof fetch;

    await getExercises({ q: 'bench', muscleGroup: MuscleGroup.CHEST }, fetchImpl);

    expect(url).toContain('q=bench');
    expect(url).toContain('muscleGroup=chest');
  });

  it('getExercises with no params omits the query string and stays backward compatible', async () => {
    let url = '';
    const fetchImpl = (async (input: RequestInfo) => {
      url = new Request(input).url;
      return ok([]);
    }) as typeof fetch;

    const out = await getExercises(undefined, fetchImpl);

    expect(url.endsWith('/exercises')).toBe(true);
    expect(out).toEqual([]);
  });

  it('getPlans fetches and parses an array of plans', async () => {
    const plan = makePlanWithTemplates();
    const fetchImpl = (async () => ok([plan])) as typeof fetch;

    const out = await getPlans(fetchImpl);

    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('plan-1');
  });

  it('getPlan fetches by id and parses PlanWithTemplates', async () => {
    const plan = makePlanWithTemplates();
    const fetchImpl = (async () => ok(plan)) as typeof fetch;

    const out = await getPlan('plan-1', fetchImpl);

    expect(out.id).toBe('plan-1');
    expect(out.templates).toHaveLength(1);
  });

  it('createPlan posts the input and parses PlanWithTemplates', async () => {
    const plan = makePlanWithTemplates();
    let seenBody: string | undefined;
    let seenMethod: string | undefined;
    const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => {
      seenBody = init?.body as string;
      seenMethod = init?.method;
      return ok(plan);
    }) as typeof fetch;

    const out = await createPlan(minimalCreateInput, fetchImpl);

    expect(out.id).toBe(plan.id);
    expect(seenMethod).toBe('POST');
    expect(seenBody).toBe(JSON.stringify(minimalCreateInput));
  });

  it('updatePlan puts the input and parses PlanWithTemplates', async () => {
    const plan = makePlanWithTemplates();
    let seenMethod: string | undefined;
    const fetchImpl = (async (_input: RequestInfo, init?: RequestInit) => {
      seenMethod = init?.method;
      return ok(plan);
    }) as typeof fetch;

    const out = await updatePlan('plan-1', minimalCreateInput, fetchImpl);

    expect(out.id).toBe(plan.id);
    expect(seenMethod).toBe('PUT');
  });

  it('activatePlan posts to the activate endpoint', async () => {
    const plan = makePlanWithTemplates();
    let seenUrl = '';
    let seenMethod: string | undefined;
    const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => {
      seenUrl = new Request(input).url;
      seenMethod = init?.method;
      return ok(plan);
    }) as typeof fetch;

    const out = await activatePlan('plan-1', fetchImpl);

    expect(out.id).toBe(plan.id);
    expect(seenUrl).toContain('/plans/plan-1/activate');
    expect(seenMethod).toBe('POST');
  });

  it('deletePlan deletes and returns { deleted: true }', async () => {
    let seenMethod: string | undefined;
    const fetchImpl = (async (_input: RequestInfo, init?: RequestInit) => {
      seenMethod = init?.method;
      return ok({ deleted: true });
    }) as typeof fetch;

    const out = await deletePlan('plan-1', fetchImpl);

    expect(out).toEqual({ deleted: true });
    expect(seenMethod).toBe('DELETE');
  });

  it('createExercise posts the input and parses Exercise', async () => {
    const exercise = {
      id: 'ex-1',
      slug: 'bench-press',
      name: { en: 'Bench Press', vi: 'Đẩy ngực' },
      muscleGroup: MuscleGroup.CHEST,
      equipmentType: EquipmentType.BARBELL,
      defaultIncrement: 2.5,
      isCustom: false,
    };
    const fetchImpl = (async () => ok(exercise)) as typeof fetch;

    const out = await createExercise(
      {
        name: { en: 'Bench Press', vi: 'Đẩy ngực' },
        muscleGroup: MuscleGroup.CHEST,
        equipmentType: EquipmentType.BARBELL,
      },
      fetchImpl,
    );

    expect(out.id).toBe('ex-1');
  });
});
