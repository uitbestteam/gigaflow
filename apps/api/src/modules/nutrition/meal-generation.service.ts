import { GenerationType, JobStatus, zGenerateMealInput, type MealPlan } from '@gigaflow/shared';
import { findJobById, setJobStatus } from '../workout/generation-job.repo.js';
import { rollbackUsage } from '../subscription/quota.service.js';
import { computeTdee } from './tdee.js';
import { buildMealPrompt } from './meal-prompt.js';
import { createMealPlan } from './meal-plan.repo.js';

export interface MealGenDeps {
  engine: {
    generateMealPlan(p: { system: string; user: string }): Promise<MealPlan>;
  };
}

export async function processGenerateMeal(jobId: string, deps: MealGenDeps): Promise<void> {
  const job = await findJobById(jobId);
  if (!job) throw new Error(`GenerationJob ${jobId} not found`);
  const { userId } = job;

  try {
    await setJobStatus(jobId, { status: JobStatus.PROCESSING });

    const input = zGenerateMealInput.parse(job.input);

    const tdee = computeTdee(input);

    const prompt = buildMealPrompt({ ...tdee, goal: input.goal });

    const plan = await deps.engine.generateMealPlan(prompt);

    const doc = await createMealPlan(userId, plan);

    await setJobStatus(jobId, { status: JobStatus.DONE, resultId: doc.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setJobStatus(jobId, { status: JobStatus.FAILED, error: message });
    await rollbackUsage(userId, GenerationType.MEAL);
    throw err;
  }
}
