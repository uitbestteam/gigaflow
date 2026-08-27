import { describe, it, expect } from 'vitest';
import { Goal, Gender, ActivityLevel } from '@gigaflow/shared';
import { computeTdee } from './tdee.js';

describe('computeTdee', () => {
  it('computes BMR/TDEE for a male, maintenance', () => {
    const r = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE });
    // BMR = 10*75 + 6.25*175 - 5*30 + 5 = 1698.75 ; TDEE = *1.55 = 2633.06 -> 2633
    expect(r.bmr).toBe(1699);
    expect(r.tdee).toBe(2633);
    expect(r.targetCalories).toBe(2633);
    expect(r.proteinG).toBe(150);
  });
  it('cuts calories for weight loss', () => {
    const r = computeTdee({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE });
    expect(r.targetCalories).toBe(Math.round(2633.06 * 0.8)); // 2106
    expect(r.carbsG).toBeGreaterThanOrEqual(0);
  });
  it('applies the female BMR offset', () => {
    const male = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.MALE, age: 30, heightCm: 165, weightKg: 60, activityLevel: ActivityLevel.SEDENTARY });
    const female = computeTdee({ goal: Goal.GENERAL_FITNESS, gender: Gender.FEMALE, age: 30, heightCm: 165, weightKg: 60, activityLevel: ActivityLevel.SEDENTARY });
    expect(male.bmr - female.bmr).toBe(166); // +5 vs -161
  });
});
