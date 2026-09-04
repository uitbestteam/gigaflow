export interface MealPromptInput {
  targetCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  goal: string;
  /** Eating pattern the whole plan must respect (default omnivore). */
  dietaryPattern?: string;
  /** Allergens/intolerances to exclude entirely. */
  allergies?: string[];
  /** Specific country cuisine to model meals on (preferred over region). */
  cuisineCountry?: string;
  /** Coarse cuisine family to model meals on. */
  cuisineRegion?: string;
  /** Free-text foods the user dislikes / wants avoided. */
  avoidFoods?: string;
  /** Meals per day including snacks. */
  mealsPerDay?: number;
}

/** Human guidance for each dietary pattern, injected into the prompt. */
const DIETARY_PATTERN_RULES: Record<string, string> = {
  omnivore: 'no restrictions.',
  vegetarian: 'no meat or fish (dairy and eggs allowed).',
  vegan: 'no animal products at all (including dairy, eggs and honey).',
  pescatarian: 'fish and seafood allowed, but no other meat.',
  halal: 'no pork and no alcohol.',
  keto: 'very low carbohydrate—keep carbs minimal and fat high.',
  low_carb: 'reduced carbohydrates across all meals.',
};

export function buildMealPrompt(input: MealPromptInput): {
  system: string;
  user: string;
} {
  const {
    targetCalories,
    proteinG,
    carbsG,
    fatG,
    goal,
    dietaryPattern,
    allergies,
    cuisineCountry,
    cuisineRegion,
    avoidFoods,
    mealsPerDay,
  } = input;

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

  // Optional intake directives — only emitted when the field is provided
  const directives: string[] = [];
  const pattern = dietaryPattern ?? 'omnivore';
  const patternRule = DIETARY_PATTERN_RULES[pattern] ?? 'no restrictions.';
  directives.push(`- Dietary pattern: ${pattern}—${patternRule} Every meal MUST comply.`);
  if (allergies && allergies.length > 0) {
    directives.push(`- Allergies: STRICTLY exclude every food containing: ${allergies.join(', ')}.`);
  }
  if (cuisineCountry) {
    directives.push(`- Cuisine: Model meals on ${cuisineCountry} cuisine—typical ingredients and dishes.`);
  } else if (cuisineRegion) {
    directives.push(`- Cuisine: Model meals on ${cuisineRegion} cuisine—typical ingredients and dishes.`);
  }
  if (avoidFoods) {
    directives.push(`- Also avoid: ${avoidFoods}.`);
  }
  if (mealsPerDay) {
    directives.push(
      `- Meals per day: Each day must contain exactly ${mealsPerDay} meals (use snacks to reach ${mealsPerDay} when more than 3).`,
    );
  }
  const directivesSection = `\n\n**Dietary Requirements:**\n${directives.join('\n')}`;

  // User prompt: context and request
  const user = `Create a 7-day meal plan.

**Target Profile:**
- Goal: ${goal}
- Target calories per day: ${targetCalories}
- Target protein per day: ${proteinG}g
- Target carbs per day: ${carbsG}g
- Target fat per day: ${fatG}g${directivesSection}

Design a structured 7-day meal plan where each day's totals are approximately ${targetCalories} calories, ${proteinG}g protein, ${carbsG}g carbs and ${fatG}g fat. Provide bilingual (English and Vietnamese) meal names. Return as minified JSON only.`;

  return { system, user };
}
