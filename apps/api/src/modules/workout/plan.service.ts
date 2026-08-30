import { PlanSource, type CreatePlanInput, type UpdatePlanInput, type PlanWithTemplates } from '@gigaflow/shared';
import {
  insertPlanGraph, replacePlanGraph, findPlanById, setActivePlan, deletePlan, type NewTemplate,
} from './workout.repo.js';

export class PlanError extends Error {
  status: number;

  constructor(message: string, status = 404) {
    super(message);
    this.status = status;
    this.name = 'PlanError';
  }
}

function normalizeTemplates(input: CreatePlanInput['templates']): NewTemplate[] {
  return input.map((template, templateIndex) => {
    for (const slot of template.slots) {
      if (slot.repRangeMax < slot.repRangeMin) {
        throw new PlanError('repRangeMax must be >= repRangeMin', 400);
      }
    }
    return {
      name: template.name,
      ...(template.focus ? { focus: template.focus } : {}),
      orderIndex: templateIndex,
      colorTag: template.colorTag,
      slots: template.slots.map((slot, slotIndex) => ({
        exerciseId: slot.exerciseId,
        orderIndex: slotIndex,
        setsTarget: slot.setsTarget,
        repRangeMin: slot.repRangeMin,
        repRangeMax: slot.repRangeMax,
        equipmentType: slot.equipmentType,
        weightIncrement: slot.weightIncrement,
      })),
    };
  });
}

export async function createPlan(userId: string, input: CreatePlanInput): Promise<PlanWithTemplates> {
  const templates = normalizeTemplates(input.templates);
  return insertPlanGraph(
    userId,
    { name: input.name, templateType: input.templateType, source: PlanSource.CUSTOM, isActive: input.isActive ?? false },
    templates,
  );
}

export async function updatePlan(userId: string, id: string, input: UpdatePlanInput): Promise<PlanWithTemplates> {
  const templates = normalizeTemplates(input.templates);
  const updated = await replacePlanGraph(
    userId,
    id,
    { name: input.name, templateType: input.templateType },
    templates,
  );
  if (!updated) throw new PlanError('Plan not found');
  return updated;
}

export async function activatePlan(userId: string, id: string): Promise<PlanWithTemplates> {
  const existing = await findPlanById(userId, id);
  if (!existing) throw new PlanError('Plan not found');
  await setActivePlan(userId, id);
  const fresh = await findPlanById(userId, id);
  if (!fresh) throw new PlanError('Plan not found');
  return fresh;
}

export async function removePlan(userId: string, id: string): Promise<void> {
  const deleted = await deletePlan(userId, id);
  if (!deleted) throw new PlanError('Plan not found');
}
