import { getDb } from '../../lib/db.js';
import { AuthProvider, AuthSource, Language, type User } from '@gigaflow/shared';

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

  const result = await collection().findOneAndUpdate(
    { authId: input.authId },
    { $set: set, $setOnInsert: setOnInsert },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } },
  );
  if (!result) throw new Error('Failed to upsert user');
  return result as User;
}

export async function findByAuthId(authId: string): Promise<User | null> {
  return collection().findOne({ authId }, { projection: { _id: 0 } }) as Promise<User | null>;
}
