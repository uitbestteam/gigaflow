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
  const user = await collection().findOne({ authId: userId }, { projection: { _id: 0 } });
  if (!user) throw new Error('User not found');

  const sub = user.subscription;
  const expired = !sub || now.getTime() - sub.periodStart.getTime() >= PERIOD_MS;

  if (expired) {
    const next = freshSubscription(now);
    await collection().updateOne({ authId: userId }, { $set: { subscription: next } });
    return next;
  }

  return sub;
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
  const user = await collection().findOne({ authId: userId }, { projection: { _id: 0 } });
  if (!user) throw new Error('User not found');
  const sub = user.subscription;
  if (!sub) return;

  const current = sub.aiUsage[type];
  const next = Math.max(0, current - 1);
  await collection().updateOne(
    { authId: userId },
    { $set: { [`subscription.aiUsage.${type}`]: next } },
  );
}
