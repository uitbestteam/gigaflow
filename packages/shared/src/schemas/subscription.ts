import { z } from 'zod';
import { GenerationType, SubscriptionPlan } from '../enums/index.js';

export const zAiUsage = z.object({
  workout: z.number().int().min(0),
  meal: z.number().int().min(0),
  inbody: z.number().int().min(0),
});

export const zSubscription = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  aiUsage: zAiUsage,
  periodStart: z.date(),
});

export type AiUsage = z.infer<typeof zAiUsage>;
export type Subscription = z.infer<typeof zSubscription>;

export const PLAN_LIMITS: Record<SubscriptionPlan, Record<GenerationType, number>> = {
  [SubscriptionPlan.FREE]: {
    [GenerationType.WORKOUT]: 10,
    [GenerationType.MEAL]: 10,
    [GenerationType.INBODY]: 5,
  },
};

export const PERIOD_DAYS = 30;
