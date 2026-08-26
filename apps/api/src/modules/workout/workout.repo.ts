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
