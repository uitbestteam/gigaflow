import {
  GenerationType, JobStatus, PlanSource, PlanTemplateType,
  zGenerateWorkoutInput, type GeneratedPlan,
} from '@gigaflow/shared';
import { listVisible, findBySlugs } from '../exercise/exercise.repo.js';
import { insertPlanGraph, type NewTemplate, type NewSlot } from './workout.repo.js';
import { findPerformanceMany } from '../training/session.repo.js';
import { rollbackUsage } from '../subscription/quota.service.js';
import { buildWorkoutPrompt, type PromptExercise, type PromptHistory } from '../ai/prompt.js';
import { findJobById, setJobStatus } from './generation-job.repo.js';

export interface WorkoutGenDeps {
  engine: {
    generateWorkoutPlan(p: { system: string; user: string }): Promise<GeneratedPlan>;
  };
}

export async function processGenerateWorkout(jobId: string, deps: WorkoutGenDeps): Promise<void> {
  const job = await findJobById(jobId);
  if (!job) throw new Error(`GenerationJob ${jobId} not found`);
  const { userId } = job;

  try {
    await setJobStatus(jobId, { status: JobStatus.PROCESSING });

    const input = zGenerateWorkoutInput.parse(job.input);

    const visible = await listVisible(userId, {});
    const presets = visible.filter((ex) => !ex.isCustom);

    const catalog: PromptExercise[] = presets.map((ex) => ({
      slug: ex.slug,
      nameEn: ex.name.en,
      muscleGroup: ex.muscleGroup,
    }));

    const exerciseIds = presets.map((ex) => ex.id);
    const perfMap = await findPerformanceMany(userId, exerciseIds);
    const idToSlug = new Map(presets.map((ex) => [ex.id, ex.slug]));

    const history: PromptHistory[] = [];
    for (const [exerciseId, perf] of perfMap) {
      const slug = idToSlug.get(exerciseId);
      const lastSet = perf.lastSets[0];
      if (!slug || !lastSet) continue;
      history.push({
        slug,
        lastWeightKg: lastSet.weightKg,
        lastReps: lastSet.repsDone,
        bestE1RM: perf.bestSet.e1RM,
      });
    }

    const prompt = buildWorkoutPrompt({
      goal: input.goal,
      experienceLevel: input.experienceLevel,
      daysPerWeek: input.daysPerWeek,
      catalog,
      history,
    });

    const plan = await deps.engine.generateWorkoutPlan(prompt);

    const slugs = plan.templates.flatMap((t) => t.slots.map((s) => s.exerciseSlug));
    const exerciseMap = await findBySlugs(slugs);

    const newTemplates: NewTemplate[] = [];
    plan.templates.forEach((t, templateIndex) => {
      const newSlots: NewSlot[] = [];
      t.slots.forEach((s, slotIndex) => {
        const ex = exerciseMap.get(s.exerciseSlug);
        if (!ex) return;
        newSlots.push({
          exerciseId: ex.id,
          orderIndex: slotIndex,
          setsTarget: s.setsTarget,
          repRangeMin: s.repRangeMin,
          repRangeMax: s.repRangeMax,
          equipmentType: ex.equipmentType,
          weightIncrement: ex.defaultIncrement,
        });
      });
      if (newSlots.length === 0) return;
      newTemplates.push({
        name: t.name,
        orderIndex: templateIndex,
        colorTag: t.colorTag,
        slots: newSlots,
      });
    });

    if (newTemplates.length === 0) {
      throw new Error('AI plan had no resolvable exercises');
    }

    const insertedPlan = await insertPlanGraph(
      userId,
      { name: plan.name, templateType: PlanTemplateType.CUSTOM, source: PlanSource.AI, isActive: true },
      newTemplates,
    );

    await setJobStatus(jobId, { status: JobStatus.DONE, resultId: insertedPlan.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setJobStatus(jobId, { status: JobStatus.FAILED, error: message });
    await rollbackUsage(userId, GenerationType.WORKOUT);
    throw err;
  }
}
