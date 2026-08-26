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
  const system = `You are a strength coach specializing in creating personalized workout plans.

You MUST respond with ONLY valid JSON that matches the following schema structure. Do not include any explanation or additional text—only the JSON object.

The JSON plan schema has:
- "days": an array of day objects
- Each day has "dayNumber" (1 to ${daysPerWeek}), "name", and "exercises" array
- Each exercise in the plan MUST use only exerciseSlug values from the provided catalog

For ${daysPerWeek} days per week, structure the plan with appropriate training split templates matching the athlete's goal and experience level.`;

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
      : 'No prior history.';

  // User prompt: context and request
  const user = `Create a ${daysPerWeek}-day per week strength training program.

**Athlete Profile:**
- Goal: ${goal}
- Experience Level: ${experienceLevel}
- Training Days Per Week: ${daysPerWeek}

**Exercise Catalog (available for this program):**
${catalogLines}

**Training History (if available):**
${historyLines}

Based on the athlete's goal, experience level, and training frequency, design a structured ${daysPerWeek}-day workout split using only exercises from the catalog above. Progress from the athlete's last recorded lifts. Return the plan as a valid JSON object with days and exercises.`;

  return { system, user };
}
