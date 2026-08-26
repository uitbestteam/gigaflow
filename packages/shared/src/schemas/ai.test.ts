import { describe, it, expect } from 'vitest';
import { zGenerateWorkoutInput, zGeneratedPlan, Goal, ExperienceLevel, ColorTag } from '../index.js';

describe('ai schemas', () => {
  it('accepts a valid generate input', () => {
    expect(zGenerateWorkoutInput.safeParse({ goal: Goal.HYPERTROPHY, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 }).success).toBe(true);
  });
  it('rejects daysPerWeek out of range', () => {
    expect(zGenerateWorkoutInput.safeParse({ goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.ADVANCED, daysPerWeek: 9 }).success).toBe(false);
  });
  it('accepts a valid generated plan', () => {
    const p = { name: 'AI Plan', templates: [{ name: { en: 'Push', vi: 'Đẩy' }, colorTag: ColorTag.PUSH, slots: [{ exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 }] }] };
    expect(zGeneratedPlan.safeParse(p).success).toBe(true);
  });
  it('rejects a generated plan with no templates', () => {
    expect(zGeneratedPlan.safeParse({ name: 'x', templates: [] }).success).toBe(false);
  });
});
