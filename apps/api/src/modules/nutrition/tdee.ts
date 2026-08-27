import { GenerateMealInput, TdeeResult, ActivityLevel, Goal, Gender } from '@gigaflow/shared';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.ACTIVE]: 1.725,
  [ActivityLevel.VERY_ACTIVE]: 1.9,
};

const GOAL_FACTORS: Record<Goal, number> = {
  [Goal.WEIGHT_LOSS]: 0.8,
  [Goal.HYPERTROPHY]: 1.1,
  [Goal.STRENGTH]: 1.05,
  [Goal.GENERAL_FITNESS]: 1.0,
};

export function computeTdee(input: GenerateMealInput): TdeeResult {
  const { gender, age, heightCm, weightKg, activityLevel, goal } = input;

  // Calculate BMR using Mifflin-St Jeor equation
  const baseBmr = 10 * weightKg + 6.25 * heightCm - 5 * age;
  const bmrUnrounded =
    gender === Gender.MALE ? baseBmr + 5 : baseBmr - 161;

  // Get activity multiplier
  const activityMultiplier = ACTIVITY_MULTIPLIERS[activityLevel];
  if (activityMultiplier === undefined) {
    throw new Error(`Invalid activity level: ${activityLevel}`);
  }

  // Calculate TDEE
  const tdeeUnrounded = bmrUnrounded * activityMultiplier;

  // Get goal factor
  const goalFactor = GOAL_FACTORS[goal];
  if (goalFactor === undefined) {
    throw new Error(`Invalid goal: ${goal}`);
  }

  // Calculate target calories
  const targetCaloriesUnrounded = tdeeUnrounded * goalFactor;

  // Calculate macros
  const proteinGUnrounded = 2 * weightKg;
  const fatGUnrounded = (targetCaloriesUnrounded * 0.25) / 9;
  const carbsGUnrounded = Math.max(
    0,
    (targetCaloriesUnrounded - proteinGUnrounded * 4 - fatGUnrounded * 9) / 4
  );

  // Round all values
  return {
    bmr: Math.round(bmrUnrounded),
    tdee: Math.round(tdeeUnrounded),
    targetCalories: Math.round(targetCaloriesUnrounded),
    proteinG: Math.round(proteinGUnrounded),
    fatG: Math.round(fatGUnrounded),
    carbsG: Math.max(0, Math.round(carbsGUnrounded)),
  };
}
