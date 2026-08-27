import type { Document, WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import type { WeightLog } from '@gigaflow/shared';

const COLLECTION = 'weight_logs';

function collection() {
  return getDb().collection(COLLECTION);
}

function mapId(doc: WithId<Document>): WeightLog {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as WeightLog;
}

export async function ensureWeightIndexes(): Promise<void> {
  await collection().createIndex({ userId: 1, loggedAt: -1 });
}

export async function logWeight(
  userId: string,
  weightKg: number,
  loggedAt?: Date,
): Promise<WeightLog> {
  const doc = {
    userId,
    weightKg,
    loggedAt: loggedAt ?? new Date(),
    createdAt: new Date(),
  };
  const res = await collection().insertOne(doc);
  return { id: res.insertedId.toString(), ...doc };
}

export async function listWeights(userId: string, limit = 100): Promise<WeightLog[]> {
  const docs = await collection()
    .find({ userId })
    .sort({ loggedAt: -1 })
    .limit(limit)
    .toArray();
  return docs.map(mapId);
}
