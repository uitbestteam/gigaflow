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
  /** Equipment the (already-filtered) catalog is limited to. */
  availableEquipment?: string[];
  /** Joints/areas to protect; the plan avoids loading these. */
  injuries?: string[];
  /** Target minutes per session; caps sets/exercises per day. */
  sessionMinutes?: number;
  /** Muscle groups to emphasize with extra volume. */
  emphasis?: string[];
}

export function buildWorkoutPrompt(input: WorkoutPromptInput): {
  system: string;
  user: string;
} {
  const {
    goal,
    experienceLevel,
    daysPerWeek,
    catalog,
    history,
    availableEquipment,
    injuries,
    sessionMinutes,
    emphasis,
  } = input;

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

  // Optional intake directives — only emitted when the field is provided
  const directives: string[] = [];
  if (availableEquipment && availableEquipment.length > 0) {
    directives.push(
      `- Equipment: the athlete can only train with ${availableEquipment.join(', ')}. The exercise catalog below is already filtered to this equipment—the plan may ONLY use these exercises.`,
    );
  }
  if (injuries && injuries.length > 0) {
    directives.push(
      `- Injuries: Athlete reports issues with: ${injuries.join(', ')}. AVOID exercises that heavily load these joints; choose joint-friendly alternatives.`,
    );
  }
  if (sessionMinutes) {
    directives.push(
      `- Session length: Each session must fit ~${sessionMinutes} minutes—keep exercises/sets per day appropriate (rule of thumb ~1 compound exercise per 10–12 min).`,
    );
  }
  if (emphasis && emphasis.length > 0) {
    directives.push(`- Emphasis: Add extra sets/volume for these muscle groups: ${emphasis.join(', ')}.`);
  }
  const directivesSection = directives.length > 0 ? `\n\n**Additional Requirements:**\n${directives.join('\n')}` : '';

  // User prompt: context and request
  const user = `Create a ${daysPerWeek}-day per week strength training program.

**Athlete Profile:**
- Goal: ${goal}
- Experience Level: ${experienceLevel}
- Training Days Per Week: ${daysPerWeek}

**Exercise Catalog (use only these exerciseSlug values):**
${catalogLines}

**Training History:**
${historyLines}${directivesSection}

Design a structured ${daysPerWeek}-day workout plan using ONLY the provided catalog exerciseSlug values. Progress from the athlete's prior lifts. Return as minified JSON only.`;

  return { system, user };
}
