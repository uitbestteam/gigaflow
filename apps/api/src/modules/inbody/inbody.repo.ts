import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import type { InbodyMetrics, InbodyResult } from '@gigaflow/shared';

const COLLECTION = 'inbody_results';

function collection() {
  return getDb().collection(COLLECTION);
}

function mapId(doc: WithId<Document>): InbodyResult {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as InbodyResult;
}

export async function ensureInbodyIndexes(): Promise<void> {
  await collection().createIndex({ userId: 1, createdAt: -1 });
}

export async function createInbodyResult(
  userId: string,
  metrics: InbodyMetrics,
): Promise<InbodyResult> {
  const now = new Date();
  const doc = {
    userId,
    metrics,
    takenAt: now,
    createdAt: now,
  };
  const res = await collection().insertOne(doc);
  return { id: res.insertedId.toString(), ...doc };
}

export async function findLatestInbody(userId: string): Promise<InbodyResult | null> {
  const doc = await collection().findOne({ userId }, { sort: { createdAt: -1 } });
  if (!doc) return null;
  return mapId(doc);
}

export async function findInbodyForUser(userId: string, id: string): Promise<InbodyResult | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id), userId });
  if (!doc) return null;
  return mapId(doc);
}
