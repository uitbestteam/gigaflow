import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import { GenerationType, JobStatus, type GenerationJob } from '@gigaflow/shared';

const COLLECTION = 'generation_jobs';

function collection() {
  return getDb().collection(COLLECTION);
}

function mapId(doc: WithId<Document>): GenerationJob {
  const { _id, ...rest } = doc;
  return { id: _id.toString(), ...(rest as object) } as unknown as GenerationJob;
}

export async function ensureGenerationJobIndexes(): Promise<void> {
  await collection().createIndex({ userId: 1, status: 1 });
}

export async function createJob(
  userId: string,
  type: GenerationType,
  input: unknown,
): Promise<GenerationJob> {
  const now = new Date();
  const doc = {
    userId,
    type,
    status: JobStatus.QUEUED,
    input,
    createdAt: now,
    updatedAt: now,
  };
  const res = await collection().insertOne(doc);
  return { id: res.insertedId.toString(), ...doc };
}

export async function setJobStatus(
  id: string,
  patch: { status: JobStatus; resultId?: string; error?: string },
): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const set: Record<string, unknown> = { status: patch.status, updatedAt: new Date() };
  if (patch.resultId !== undefined) set.resultId = patch.resultId;
  if (patch.error !== undefined) set.error = patch.error;
  await collection().updateOne({ _id: new ObjectId(id) }, { $set: set });
}

export async function findJobForUser(userId: string, id: string): Promise<GenerationJob | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id), userId });
  if (!doc) return null;
  return mapId(doc);
}

export async function findJobById(id: string): Promise<GenerationJob | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  if (!doc) return null;
  return mapId(doc);
}
