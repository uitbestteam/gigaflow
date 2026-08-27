import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { connectDb } from './lib/db.js';

const port = Number(process.env.PORT ?? 8080);

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await connectDb(uri, process.env.MONGODB_DB ?? 'gigaflow');
    const { ensureUserIndexes } = await import('./modules/auth/user.repo.js');
    await ensureUserIndexes();
    const { ensureExerciseIndexes } = await import('./modules/exercise/exercise.repo.js');
    const { seedPresets } = await import('./modules/exercise/seed-exercises.js');
    await ensureExerciseIndexes();
    await seedPresets();
    const { ensureWorkoutIndexes } = await import('./modules/workout/workout.repo.js');
    await ensureWorkoutIndexes();
    const { ensureTrainingIndexes } = await import('./modules/training/session.repo.js');
    await ensureTrainingIndexes();
    const { ensureGenerationJobIndexes } = await import('./modules/workout/generation-job.repo.js');
    await ensureGenerationJobIndexes();
    const { ensureMealPlanIndexes } = await import('./modules/nutrition/meal-plan.repo.js');
    await ensureMealPlanIndexes();
  }
  const app = createApp();
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
  console.log(`API listening on :${port}`);
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
