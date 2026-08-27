import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, GenerationType, zGenerateWorkoutInput } from '@gigaflow/shared';
import { internalAuth } from '../../middleware/internal-auth.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { quotaGuard } from '../subscription/quota.guard.js';
import { incrementUsage } from '../subscription/quota.service.js';
import { createJob, findJobForUser } from './generation-job.repo.js';
import { processGenerateWorkout, type WorkoutGenDeps } from './workout-generation.service.js';
import { processGenerateMeal, type MealGenDeps } from '../nutrition/meal-generation.service.js';

type InternalTaskEngine = WorkoutGenDeps['engine'] & MealGenDeps['engine'];

export type TaskEnqueuer = (jobId: string) => Promise<void>;

export function inlineEnqueuer(deps: WorkoutGenDeps): TaskEnqueuer {
  return async (jobId) => processGenerateWorkout(jobId, deps);
}

const generateWorkoutTaskBody = z.object({ jobId: z.string().min(1) });
const generateMealTaskBody = z.object({ jobId: z.string().min(1) });

export function makeWorkoutGenRoutes(deps: {
  verify: TokenVerifier;
  engine: WorkoutGenDeps['engine'];
  enqueue: TaskEnqueuer;
}): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post(
    '/generate',
    quotaGuard(GenerationType.WORKOUT),
    zValidator('json', zGenerateWorkoutInput),
    async (c) => {
      const user = c.get('user');
      const input = c.req.valid('json');
      await incrementUsage(user.authId, GenerationType.WORKOUT, new Date());
      const job = await createJob(user.authId, GenerationType.WORKOUT, input);
      await deps.enqueue(job.id);
      return c.json(apiSuccess({ jobId: job.id }), 202);
    },
  );

  app.get('/jobs/:id', async (c) => {
    const user = c.get('user');
    const job = await findJobForUser(user.authId, c.req.param('id'));
    return c.json(apiSuccess(job));
  });

  return app;
}

export function makeInternalTaskRoutes(deps: { engine: InternalTaskEngine }): Hono {
  const app = new Hono();
  app.use('*', internalAuth());

  app.get('/ping', (c) => c.json(apiSuccess({ pong: true })));

  app.post('/generate-workout', zValidator('json', generateWorkoutTaskBody), async (c) => {
    const { jobId } = c.req.valid('json');
    await processGenerateWorkout(jobId, { engine: deps.engine });
    return c.json(apiSuccess({ ok: true }));
  });

  app.post('/generate-meal', zValidator('json', generateMealTaskBody), async (c) => {
    const { jobId } = c.req.valid('json');
    await processGenerateMeal(jobId, { engine: deps.engine });
    return c.json(apiSuccess({ ok: true }));
  });

  return app;
}
