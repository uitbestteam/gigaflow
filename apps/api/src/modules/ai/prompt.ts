export interface PromptExercise {
  slug: string;
  nameEn: string;
  muscleGroup: string;
}

export interface PromptHistory {
  slug: string;
  lastWeightKg: number;
  lastReps: number;
  bestE1RM: number;
}

export interface WorkoutPromptInput {
  goal: string;
  experienceLevel: string;
  daysPerWeek: number;
  catalog: PromptExercise[];
  history: PromptHistory[];
}

export function buildWorkoutPrompt(input: WorkoutPromptInput): {
  system: string;
  user: string;
} {
  const { goal, experienceLevel, daysPerWeek, catalog, history } = input;

  // System prompt: defines role and constraints
  // Instructs model to return minified JSON only, matching zGeneratedPlan schema exactly
  const system = `You are a strength coach. Return ONLY minified JSON matching this exact schema—no prose, no markdown, no explanation.

{
  "name": string,
  "templates": [
    {
      "name": { "en": string, "vi": string },
      "colorTag": "push"|"pull"|"legs"|"upper"|"lower"|"full"|"custom",
      "slots": [
        { "exerciseSlug": string, "setsTarget": 1-10, "repRangeMin": >=1, "repRangeMax": >=1 }
      ]
    }
  ]
}

CONSTRAINTS:
- templates array MUST have exactly ${daysPerWeek} entries
- exerciseSlug MUST be one of the provided catalog slugs only
- colorTag MUST be one of: push, pull, legs, upper, lower, full, custom
- setsTarget must be 1-10
- repRangeMin and repRangeMax must be >= 1
- Respond with ONLY the JSON object, minified`;

  // Build catalog section
  const catalogLines = catalog
    .map((ex) => `${ex.slug} — ${ex.nameEn} — ${ex.muscleGroup}`)
    .join('\n');

  // Build history section
  const historyLines =
    history.length > 0
      ? history
          .map(
            (h) =>
              `${h.slug}: last set ${h.lastWeightKg}kg × ${h.lastReps} reps, best e1RM ${h.bestE1RM}kg`
          )
          .join('\n')
      : 'No prior training history.';

  // User prompt: context and request
  const user = `Create a ${daysPerWeek}-day per week strength training program.

**Athlete Profile:**
- Goal: ${goal}
- Experience Level: ${experienceLevel}
- Training Days Per Week: ${daysPerWeek}

**Exercise Catalog (use only these exerciseSlug values):**
${catalogLines}

**Training History:**
${historyLines}

Design a structured ${daysPerWeek}-day workout plan using ONLY the provided catalog exerciseSlug values. Progress from the athlete's prior lifts. Return as minified JSON only.`;

  return { system, user };
}
