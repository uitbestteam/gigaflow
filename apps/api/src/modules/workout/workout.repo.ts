import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import {
  type ColorTag, type EquipmentType, type PlanSource, type PlanTemplateType,
  type Translatable, type Plan, type WorkoutTemplate, type ExerciseSlot, type PlanWithTemplates,
} from '@gigaflow/shared';

const PLANS = 'plans';
const TEMPLATES = 'workout_templates';
const SLOTS = 'exercise_slots';

export interface NewSlot {
  exerciseId: string; orderIndex: number; setsTarget: number;
  repRangeMin: number; repRangeMax: number; equipmentType: EquipmentType; weightIncrement: number;
}
export interface NewTemplate {
  name: Translatable; focus?: Translatable; orderIndex: number; colorTag: ColorTag; slots: NewSlot[];
}

function plans() { return getDb().collection(PLANS); }
function templates() { return getDb().collection(TEMPLATES); }
function slots() { return getDb().collection(SLOTS); }

function mapId<T extends Record<string, unknown>>(doc: WithId<Document>): T {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as T;
}

export async function ensureWorkoutIndexes(): Promise<void> {
  await plans().createIndex({ userId: 1, isActive: 1 });
  await templates().createIndex({ planId: 1, orderIndex: 1 });
  await slots().createIndex({ templateId: 1, orderIndex: 1 });
}

async function insertTemplates(
  planId: string,
  newTemplates: NewTemplate[],
): Promise<(WorkoutTemplate & { slots: ExerciseSlot[] })[]> {
  const outTemplates: (WorkoutTemplate & { slots: ExerciseSlot[] })[] = [];
  for (const t of newTemplates) {
    const tDoc: Record<string, unknown> = { planId, name: t.name, orderIndex: t.orderIndex, colorTag: t.colorTag };
    if (t.focus) tDoc.focus = t.focus;
    const tRes = await templates().insertOne(tDoc);
    const templateId = tRes.insertedId.toString();

    const outSlots: ExerciseSlot[] = [];
    for (const s of t.slots) {
      const sDoc = { templateId, ...s };
      const sRes = await slots().insertOne(sDoc);
      outSlots.push({ id: sRes.insertedId.toString(), ...sDoc });
    }
    outTemplates.push({ id: templateId, planId, name: t.name, ...(t.focus ? { focus: t.focus } : {}), orderIndex: t.orderIndex, colorTag: t.colorTag, slots: outSlots });
  }
  return outTemplates;
}

export async function insertPlanGraph(
  userId: string,
  planData: { name: string; templateType: PlanTemplateType; source: PlanSource; isActive: boolean },
  newTemplates: NewTemplate[],
): Promise<PlanWithTemplates> {
  if (planData.isActive) {
    await plans().updateMany({ userId, isActive: true }, { $set: { isActive: false } });
  }
  const planDoc = { userId, ...planData, createdAt: new Date() };
  const planRes = await plans().insertOne(planDoc);
  const planId = planRes.insertedId.toString();

  const outTemplates = await insertTemplates(planId, newTemplates);

  return { id: planId, userId, name: planData.name, templateType: planData.templateType, source: planData.source, isActive: planData.isActive, createdAt: planDoc.createdAt, templates: outTemplates };
}

export async function findActivePlan(userId: string): Promise<PlanWithTemplates | null> {
  const planDoc = await plans().findOne({ userId, isActive: true });
  if (!planDoc) return null;
  const plan = mapId<Plan>(planDoc);
  const tDocs = await templates().find({ planId: plan.id }).sort({ orderIndex: 1 }).toArray();
  const outTemplates = [];
  for (const tDoc of tDocs) {
    const template = mapId<WorkoutTemplate>(tDoc);
    const sDocs = await slots().find({ templateId: template.id }).sort({ orderIndex: 1 }).toArray();
    outTemplates.push({ ...template, slots: sDocs.map((d) => mapId<ExerciseSlot>(d)) });
  }
  return { ...plan, templates: outTemplates };
}

export async function setActivePlan(userId: string, planId: string): Promise<void> {
  await plans().updateMany({ userId, isActive: true }, { $set: { isActive: false } });
  await plans().updateOne({ _id: new ObjectId(planId), userId }, { $set: { isActive: true } });
}

export async function getTemplateWithSlotsForUser(
  userId: string, templateId: string,
): Promise<{ template: WorkoutTemplate; slots: ExerciseSlot[] } | null> {
  if (!ObjectId.isValid(templateId)) return null;
  const tDoc = await templates().findOne({ _id: new ObjectId(templateId) });
  if (!tDoc) return null;
  const template = mapId<WorkoutTemplate>(tDoc);
  if (!ObjectId.isValid(template.planId)) return null;
  const planDoc = await plans().findOne({ _id: new ObjectId(template.planId), userId });
  if (!planDoc) return null;
  const sDocs = await slots().find({ templateId: template.id }).sort({ orderIndex: 1 }).toArray();
  return { template, slots: sDocs.map((d) => mapId<ExerciseSlot>(d)) };
}

export async function listPlans(userId: string): Promise<Plan[]> {
  const docs = await plans().find({ userId }).sort({ createdAt: -1, _id: -1 }).toArray();
  return docs.map((d) => mapId<Plan>(d));
}

export async function findPlanById(userId: string, planId: string): Promise<PlanWithTemplates | null> {
  if (!ObjectId.isValid(planId)) return null;
  const planDoc = await plans().findOne({ _id: new ObjectId(planId), userId });
  if (!planDoc) return null;
  const plan = mapId<Plan>(planDoc);
  const tDocs = await templates().find({ planId: plan.id }).sort({ orderIndex: 1 }).toArray();
  const outTemplates = [];
  for (const tDoc of tDocs) {
    const template = mapId<WorkoutTemplate>(tDoc);
    const sDocs = await slots().find({ templateId: template.id }).sort({ orderIndex: 1 }).toArray();
    outTemplates.push({ ...template, slots: sDocs.map((d) => mapId<ExerciseSlot>(d)) });
  }
  return { ...plan, templates: outTemplates };
}

export async function replacePlanGraph(
  userId: string,
  planId: string,
  planData: Partial<{ name: string; templateType: PlanTemplateType; isActive: boolean }>,
  newTemplates: NewTemplate[],
): Promise<PlanWithTemplates | null> {
  if (!ObjectId.isValid(planId)) return null;
  const planDoc = await plans().findOne({ _id: new ObjectId(planId), userId });
  if (!planDoc) return null;
  const existing = mapId<Plan>(planDoc);

  const tDocs = await templates().find({ planId: existing.id }).toArray();
  const templateIds = tDocs.map((t) => t._id.toString());
  if (templateIds.length > 0) {
    await slots().deleteMany({ templateId: { $in: templateIds } });
    await templates().deleteMany({ planId: existing.id });
  }

  const update: Record<string, unknown> = {};
  if (planData.name !== undefined) update.name = planData.name;
  if (planData.templateType !== undefined) update.templateType = planData.templateType;
  if (planData.isActive !== undefined) update.isActive = planData.isActive;
  if (Object.keys(update).length > 0) {
    await plans().updateOne({ _id: new ObjectId(planId) }, { $set: update });
  }

  const outTemplates = await insertTemplates(existing.id, newTemplates);

  return {
    id: existing.id,
    userId: existing.userId,
    name: planData.name ?? existing.name,
    templateType: planData.templateType ?? existing.templateType,
    source: existing.source,
    isActive: planData.isActive ?? existing.isActive,
    createdAt: existing.createdAt,
    templates: outTemplates,
  };
}

export async function deletePlan(userId: string, planId: string): Promise<boolean> {
  if (!ObjectId.isValid(planId)) return false;
  const planDoc = await plans().findOne({ _id: new ObjectId(planId), userId });
  if (!planDoc) return false;
  const existing = mapId<Plan>(planDoc);

  const tDocs = await templates().find({ planId: existing.id }).toArray();
  const templateIds = tDocs.map((t) => t._id.toString());
  if (templateIds.length > 0) {
    await slots().deleteMany({ templateId: { $in: templateIds } });
    await templates().deleteMany({ planId: existing.id });
  }
  await plans().deleteOne({ _id: new ObjectId(planId) });
  return true;
}
