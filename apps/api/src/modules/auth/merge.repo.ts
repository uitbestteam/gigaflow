import { getDb } from '../../lib/db.js';

/**
 * Collections whose documents are owned by a user via a `userId` field equal to
 * the Firebase uid (authId). Nested docs (workout_templates, exercise_slots)
 * are reached through their parent plan, so reassigning the plan is enough.
 */
const OWNED_COLLECTIONS = [
  'plans',
  'training_sessions',
  'exercise_performance',
  'inbody_results',
  'weight_logs',
  'device_tokens',
  'generation_jobs',
  'meal_plans',
  'exercises', // custom user exercises (global ones have no userId)
] as const;

export interface MergeResult {
  movedByCollection: Record<string, number>;
  totalMoved: number;
  guestUserDeleted: boolean;
}

/**
 * Reassign every document owned by `guestUid` to `targetUid`, then delete the
 * guest's own user document. Used when a returning user signs in with Google
 * (their identity already owns an account) but had built data as a fresh guest
 * — we move that guest data onto their real account instead of orphaning it.
 *
 * Idempotent and safe when the guest owns nothing (all counts 0). No-op guard
 * for `guestUid === targetUid` is the caller's responsibility.
 */
export async function mergeGuestData(guestUid: string, targetUid: string): Promise<MergeResult> {
  const db = getDb();
  const movedByCollection: Record<string, number> = {};
  let totalMoved = 0;

  for (const name of OWNED_COLLECTIONS) {
    const res = await db
      .collection(name)
      .updateMany({ userId: guestUid }, { $set: { userId: targetUid } });
    movedByCollection[name] = res.modifiedCount;
    totalMoved += res.modifiedCount;
  }

  const del = await db.collection('users').deleteOne({ authId: guestUid });

  return { movedByCollection, totalMoved, guestUserDeleted: del.deletedCount > 0 };
}
