export interface MealPromptInput {
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  goal: string;
}

export function buildMealPrompt(input: MealPromptInput): {
  system: string;
  user: string;
} {
  const { targetCalories, proteinG, carbsG, fatG, goal } = input;

  // System prompt: defines role and constraints
  // Instructs model to return minified JSON only, matching zMealPlan schema exactly
  const system = `You are a nutrition coach. Return ONLY minified JSON matching this exact schema—no prose, no markdown, no explanation.

{
  "name": string,
  "days": [
    {
      "dayIndex": 1-7,
      "meals": [
        {
          "name": { "en": string, "vi": string },
          "mealType": "breakfast"|"lunch"|"dinner"|"snack",
          "calories": number,
          "proteinG": number,
          "carbsG": number,
          "fatG": number,
          "ingredients": [string]
        }
      ],
      "totalCalories": number,
      "totalProteinG": number,
      "totalCarbsG": number,
      "totalFatG": number
    }
  ]
}

CONSTRAINTS:
- days array MUST have exactly 7 entries, dayIndex 1 through 7
- mealType MUST be one of: breakfast, lunch, dinner, snack
- each meal MUST have a bilingual name with "en" and "vi"
- each day's totalCalories, totalProteinG, totalCarbsG and totalFatG MUST be the sum of that day's meals and MUST be approximately equal to the target calories and macros
- Respond with ONLY the JSON object, minified`;

  // User prompt: context and request
  const user = `Create a 7-day meal plan.

**Target Profile:**
- Goal: ${goal}
- Target calories per day: ${targetCalories}
- Target protein per day: ${proteinG}g
- Target carbs per day: ${carbsG}g
- Target fat per day: ${fatG}g

Design a structured 7-day meal plan where each day's totals are approximately ${targetCalories} calories, ${proteinG}g protein, ${carbsG}g carbs and ${fatG}g fat. Provide bilingual (English and Vietnamese) meal names. Return as minified JSON only.`;

  return { system, user };
}
