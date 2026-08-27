import { getDb } from '../../lib/db.js';
import {
  GenerationType,
  SubscriptionPlan,
  PLAN_LIMITS,
  PERIOD_DAYS,
  type Subscription,
  type User,
} from '@gigaflow/shared';

const COLLECTION = 'users';
const PERIOD_MS = PERIOD_DAYS * 24 * 60 * 60 * 1000;

export interface QuotaStatus {
  allowed: boolean;
  plan: SubscriptionPlan;
  type: GenerationType;
  used: number;
  limit: number;
}

function collection() {
  return getDb().collection<User>(COLLECTION);
}

function freshSubscription(now: Date): Subscription {
  return {
    plan: SubscriptionPlan.FREE,
    aiUsage: { workout: 0, meal: 0, inbody: 0 },
    periodStart: now,
  };
}

export async function ensureCurrentPeriod(userId: string, now: Date): Promise<Subscription> {
  const cutoff = new Date(now.getTime() - PERIOD_MS);

  // Atomically reset the period only if it is missing or expired, so concurrent callers
  // for a not-yet-initialized/expired user can't each independently overwrite each
  // other's aiUsage with a fresh zeroed subscription (a TOCTOU on the period reset itself).
  const reset = await collection().findOneAndUpdate(
    {
      authId: userId,
      $or: [{ subscription: { $exists: false } }, { 'subscription.periodStart': { $lt: cutoff } }],
    },
    { $set: { subscription: freshSubscription(now) } },
    { returnDocument: 'after' },
  );
  if (reset?.subscription) return reset.subscription;

  const user = await collection().findOne({ authId: userId }, { projection: { _id: 0 } });
  if (!user) throw new Error('User not found');
  if (!user.subscription) throw new Error('User not found');
  return user.subscription;
}

export async function checkQuota(
  userId: string,
  type: GenerationType,
  now: Date,
): Promise<QuotaStatus> {
  const sub = await ensureCurrentPeriod(userId, now);
  const plan = sub.plan;
  const used = sub.aiUsage[type];
  const limit = PLAN_LIMITS[plan][type];
  return {
    allowed: used < limit,
    plan,
    type,
    used,
    limit,
  };
}

export interface ConsumeResult {
  allowed: boolean;
  used: number;
  limit: number;
}

export async function tryConsume(
  userId: string,
  type: GenerationType,
  now: Date,
): Promise<ConsumeResult> {
  const sub = await ensureCurrentPeriod(userId, now);
  const plan = sub.plan;
  const planLimits = PLAN_LIMITS[plan];
  if (!planLimits) throw new Error(`No limits configured for plan: ${plan}`);
  const limit = planLimits[type];
  if (limit === undefined) throw new Error(`No limit configured for type: ${type}`);

  const field = `subscription.aiUsage.${type}`;
  const result = await collection().findOneAndUpdate(
    { authId: userId, [field]: { $lt: limit } },
    { $inc: { [field]: 1 } },
    { returnDocument: 'after' },
  );

  if (!result?.subscription) {
    return { allowed: false, used: limit, limit };
  }
  return { allowed: true, used: result.subscription.aiUsage[type], limit };
}

export async function incrementUsage(
  userId: string,
  type: GenerationType,
  now: Date,
): Promise<void> {
  await ensureCurrentPeriod(userId, now);
  await collection().updateOne(
    { authId: userId },
    { $inc: { [`subscription.aiUsage.${type}`]: 1 } },
  );
}

export async function rollbackUsage(userId: string, type: GenerationType): Promise<void> {
  const field = `subscription.aiUsage.${type}`;
  await collection().findOneAndUpdate(
    { authId: userId, [field]: { $gt: 0 } },
    { $inc: { [field]: -1 } },
  );
}
