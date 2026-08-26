import { describe, it, expect } from 'vitest';
import { zSubscription, PLAN_LIMITS, PERIOD_DAYS, SubscriptionPlan, GenerationType } from '../index';

describe('subscription schema', () => {
  it('accepts a valid subscription', () => {
    const r = zSubscription.safeParse({ plan: SubscriptionPlan.FREE, aiUsage: { workout: 0, meal: 0, inbody: 0 }, periodStart: new Date() });
    expect(r.success).toBe(true);
  });
  it('rejects negative usage', () => {
    const r = zSubscription.safeParse({ plan: SubscriptionPlan.FREE, aiUsage: { workout: -1, meal: 0, inbody: 0 }, periodStart: new Date() });
    expect(r.success).toBe(false);
  });
  it('exposes FREE limits for each generation type', () => {
    expect(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.WORKOUT]).toBe(10);
    expect(PLAN_LIMITS[SubscriptionPlan.FREE][GenerationType.INBODY]).toBe(5);
    expect(PERIOD_DAYS).toBe(30);
  });
});
