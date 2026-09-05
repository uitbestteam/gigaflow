import { getDb } from '../../lib/db.js';
import { AuthProvider, AuthSource, Language, type User, type UserProfile } from '@gigaflow/shared';

const COLLECTION = 'users';

export interface UpsertUserInput {
  authId: string;
  authProvider: AuthProvider;
  isGuest: boolean;
  email?: string;
  displayName?: string;
}

function collection() {
  return getDb().collection<User>(COLLECTION);
}

export async function ensureUserIndexes(): Promise<void> {
  await collection().createIndex({ authId: 1 }, { unique: true });
}

export async function upsertByAuthId(input: UpsertUserInput): Promise<User> {
  const now = new Date();
  const set: Partial<User> = {
    authProvider: input.authProvider,
    isGuest: input.isGuest,
    updatedAt: now,
  };
  if (input.email !== undefined) set.email = input.email;
  if (input.displayName !== undefined) set.displayName = input.displayName;

  const setOnInsert: Partial<User> = {
    authId: input.authId,
    authSource: AuthSource.FIREBASE,
    timezone: 'Asia/Ho_Chi_Minh',
    language: Language.EN,
    createdAt: now,
  };

  const filter = { authId: input.authId };
  const update = { $set: set, $setOnInsert: setOnInsert };
  const options = { upsert: true, returnDocument: 'after' as const, projection: { _id: 0 } };

  let result;
  try {
    result = await collection().findOneAndUpdate(filter, update, options);
  } catch (err) {
    if (!isDuplicateKeyError(err)) throw err;
    // Lost the upsert race: another concurrent call already inserted the doc.
    // Retry the same findOneAndUpdate — it now matches and updates in place.
    result = await collection().findOneAndUpdate(filter, update, options);
  }
  if (!result) throw new Error('Failed to upsert user');
  return result as User;
}

function isDuplicateKeyError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  if ('code' in err && (err as { code?: unknown }).code === 11000) return true;
  const name = 'name' in err ? (err as { name?: unknown }).name : undefined;
  const message = 'message' in err ? (err as { message?: unknown }).message : undefined;
  if (typeof name === 'string' && name === 'MongoServerError' && typeof message === 'string' && message.includes('E11000')) {
    return true;
  }
  return typeof message === 'string' && message.includes('E11000');
}

export async function findByAuthId(authId: string): Promise<User | null> {
  return collection().findOne({ authId }, { projection: { _id: 0 } }) as Promise<User | null>;
}

/**
 * Persist the onboarding profile: `$set`s `profile` + stamps `onboardedAt` so
 * the client won't re-show the onboarding flow. Returns the updated user doc.
 */
export async function setProfile(authId: string, profile: UserProfile): Promise<User> {
  const now = new Date();
  const result = await collection().findOneAndUpdate(
    { authId },
    { $set: { profile, onboardedAt: now, updatedAt: now } },
    { returnDocument: 'after', projection: { _id: 0 } },
  );
  if (!result) throw new Error('User not found');
  return result as User;
}
