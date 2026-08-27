import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import type { MealPlan, MealPlanDoc } from '@gigaflow/shared';

const COLLECTION = 'meal_plans';

function collection() {
  return getDb().collection(COLLECTION);
}

function mapId(doc: WithId<Document>): MealPlanDoc {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as MealPlanDoc;
}

export async function ensureMealPlanIndexes(): Promise<void> {
  await collection().createIndex({ userId: 1, isActive: 1 });
}

export async function createMealPlan(userId: string, plan: MealPlan): Promise<MealPlanDoc> {
  await collection().updateMany({ userId, isActive: true }, { $set: { isActive: false } });

  const doc = {
    userId,
    ...plan,
    isActive: true,
    createdAt: new Date(),
  };
  const res = await collection().insertOne(doc);
  return { id: res.insertedId.toString(), ...doc };
}

export async function findActiveMealPlan(userId: string): Promise<MealPlanDoc | null> {
  const doc = await collection().findOne({ userId, isActive: true });
  if (!doc) return null;
  return mapId(doc);
}

export async function findMealPlanForUser(userId: string, id: string): Promise<MealPlanDoc | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id), userId });
  if (!doc) return null;
  return mapId(doc);
}
