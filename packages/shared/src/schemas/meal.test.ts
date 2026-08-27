import { describe, it, expect } from 'vitest';
import { zGenerateMealInput, zMealPlan, Goal, Gender, ActivityLevel, MealType } from '../index';

describe('meal schemas', () => {
  it('accepts a valid generate-meal input', () => {
    expect(zGenerateMealInput.safeParse({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 30, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE }).success).toBe(true);
  });
  it('rejects an out-of-range age', () => {
    expect(zGenerateMealInput.safeParse({ goal: Goal.WEIGHT_LOSS, gender: Gender.MALE, age: 5, heightCm: 175, weightKg: 75, activityLevel: ActivityLevel.MODERATE }).success).toBe(false);
  });
  it('accepts a valid meal plan', () => {
    const p = { name: 'Cut', days: [{ dayIndex: 1, meals: [{ name: { en: 'Oats', vi: 'Yến mạch' }, mealType: MealType.BREAKFAST, calories: 400, proteinG: 20, carbsG: 60, fatG: 8, ingredients: ['oats', 'milk'] }], totalCalories: 400, totalProteinG: 20, totalCarbsG: 60, totalFatG: 8 }] };
    expect(zMealPlan.safeParse(p).success).toBe(true);
  });
  it('rejects a meal plan with no days', () => {
    expect(zMealPlan.safeParse({ name: 'x', days: [] }).success).toBe(false);
  });
});
