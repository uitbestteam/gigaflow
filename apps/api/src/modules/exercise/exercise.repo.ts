import { ObjectId, type Document, type WithId } from 'mongodb';
import { getDb } from '../../lib/db.js';
import {
  EquipmentType, MuscleGroup, type Exercise, type CreateExerciseInput,
} from '@gigaflow/shared';
import { slugify } from './slugify.js';

const COLLECTION = 'exercises';
const DEFAULT_INCREMENT = 2.5;

export class ExerciseConflictError extends Error {
  constructor(message = 'Exercise already exists') {
    super(message);
    this.name = 'ExerciseConflictError';
  }
}

export interface PresetSeed {
  slug: string;
  name: { en: string; vi: string };
  muscleGroup: MuscleGroup;
  equipmentType: EquipmentType;
  defaultIncrement: number;
  videoUrl?: string;
}

function collection() {
  return getDb().collection(COLLECTION);
}

function toExercise(doc: WithId<Document>): Exercise {
  const { _id, ownerUserId, videoUrl, ...rest } = doc as WithId<Document> & {
    ownerUserId?: string | null;
    videoUrl?: string | null;
  };
  const base = { id: _id.toString(), ...(rest as Omit<Exercise, 'id' | 'ownerUserId' | 'videoUrl'>) };
  return {
    ...base,
    ...(ownerUserId ? { ownerUserId } : {}),
    ...(videoUrl ? { videoUrl } : {}),
  };
}

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code?: unknown }).code === 11000;
}

export async function ensureExerciseIndexes(): Promise<void> {
  await collection().createIndex({ slug: 1, ownerUserId: 1 }, { unique: true });
  await collection().createIndex({ muscleGroup: 1 });
}

export async function upsertPreset(p: PresetSeed): Promise<void> {
  await collection().updateOne(
    { slug: p.slug, ownerUserId: null },
    {
      $set: {
        name: p.name,
        muscleGroup: p.muscleGroup,
        equipmentType: p.equipmentType,
        defaultIncrement: p.defaultIncrement,
        videoUrl: p.videoUrl,
        isCustom: false,
      },
      $setOnInsert: { slug: p.slug, ownerUserId: null },
    },
    { upsert: true },
  );
}

export async function createCustom(ownerUserId: string, input: CreateExerciseInput): Promise<Exercise> {
  const doc = {
    slug: slugify(input.name.en),
    name: input.name,
    muscleGroup: input.muscleGroup,
    equipmentType: input.equipmentType,
    defaultIncrement: input.defaultIncrement ?? DEFAULT_INCREMENT,
    videoUrl: input.videoUrl,
    isCustom: true,
    ownerUserId,
  };
  try {
    const res = await collection().insertOne(doc);
    return toExercise({ _id: res.insertedId, ...doc } as WithId<Document>);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw new ExerciseConflictError();
    throw err;
  }
}

export async function listVisible(
  userId: string,
  filter: { muscleGroup?: MuscleGroup; q?: string },
): Promise<Exercise[]> {
  const query: Record<string, unknown> = { $or: [{ isCustom: false }, { ownerUserId: userId }] };
  if (filter.muscleGroup) query.muscleGroup = filter.muscleGroup;
  if (filter.q && filter.q.trim()) {
    const rx = new RegExp(filter.q.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$and = [{ $or: [{ 'name.en': rx }, { 'name.vi': rx }] }];
  }
  const docs = await collection().find(query).sort({ 'name.en': 1 }).toArray();
  return docs.map(toExercise);
}

export async function findById(id: string): Promise<Exercise | null> {
  if (!ObjectId.isValid(id)) return null;
  const doc = await collection().findOne({ _id: new ObjectId(id) });
  return doc ? toExercise(doc) : null;
}

export async function findBySlugs(slugs: string[]): Promise<Map<string, Exercise>> {
  const docs = await collection().find({ slug: { $in: slugs }, ownerUserId: null }).toArray();
  const map = new Map<string, Exercise>();
  for (const doc of docs) {
    const ex = toExercise(doc);
    map.set(ex.slug, ex);
  }
  return map;
}
