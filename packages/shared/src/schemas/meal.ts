import { z } from 'zod';
import {
  Goal,
  Gender,
  ActivityLevel,
  MealType,
  CuisineRegion,
  Country,
  DietaryPattern,
  Allergen,
} from '../enums/index.js';
import { zTranslatable } from './common.js';

export const zGenerateMealInput = z.object({
  goal: z.nativeEnum(Goal),
  gender: z.nativeEnum(Gender),
  age: z.number().int().min(10).max(100),
  heightCm: z.number().gt(0),
  weightKg: z.number().gt(0),
  activityLevel: z.nativeEnum(ActivityLevel),
  /** Coarse cuisine family (e.g. east_asian, western). */
  cuisineRegion: z.nativeEnum(CuisineRegion).optional(),
  /** Specific country cuisine to model on; refines cuisineRegion. */
  cuisineCountry: z.nativeEnum(Country).optional(),
  /** Eating pattern the whole plan must respect (default omnivore). */
  dietaryPattern: z.nativeEnum(DietaryPattern).optional(),
  /** Allergens/intolerances to exclude entirely. */
  allergies: z.array(z.nativeEnum(Allergen)).optional(),
  /** Free-text foods the user dislikes / wants avoided. */
  avoidFoods: z.string().max(300).optional(),
  /** Meals per day including snacks (3–5 typical). */
  mealsPerDay: z.number().int().min(2).max(6).optional(),
});

export const zTdeeResult = z.object({
  bmr: z.number().int().min(0),
  tdee: z.number().int().min(0),
  targetCalories: z.number().int().min(0),
  proteinG: z.number().int().min(0),
  carbsG: z.number().int().min(0),
  fatG: z.number().int().min(0),
});

export const zMeal = z.object({
  name: zTranslatable,
  mealType: z.nativeEnum(MealType),
  calories: z.number().min(0),
  proteinG: z.number().min(0),
  carbsG: z.number().min(0),
  fatG: z.number().min(0),
  ingredients: z.array(z.string()),
});

export const zMealDay = z.object({
  dayIndex: z.number().int().min(1).max(7),
  meals: z.array(zMeal).min(1),
  totalCalories: z.number().min(0),
  totalProteinG: z.number().min(0),
  totalCarbsG: z.number().min(0),
  totalFatG: z.number().min(0),
});

export const zMealPlan = z.object({
  name: z.string().min(1),
  days: z.array(zMealDay).min(1),
});

export const zMealPlanDoc = zMealPlan.extend({
  id: z.string(),
  userId: z.string(),
  createdAt: z.coerce.date(),
  isActive: z.boolean(),
});

export type GenerateMealInput = z.infer<typeof zGenerateMealInput>;
export type TdeeResult = z.infer<typeof zTdeeResult>;
export type Meal = z.infer<typeof zMeal>;
export type MealDay = z.infer<typeof zMealDay>;
export type MealPlan = z.infer<typeof zMealPlan>;
export type MealPlanDoc = z.infer<typeof zMealPlanDoc>;
