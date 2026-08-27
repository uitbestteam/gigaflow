import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, GenerationType, zGenerateMealInput } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { quotaGuard } from '../subscription/quota.guard.js';
import { incrementUsage } from '../subscription/quota.service.js';
import { createJob, findJobForUser } from '../workout/generation-job.repo.js';
import type { TaskEnqueuer } from '../workout/workout-gen.routes.js';
import { processGenerateMeal, type MealGenDeps } from './meal-generation.service.js';
import { findActiveMealPlan } from './meal-plan.repo.js';

export function inlineMealEnqueuer(deps: MealGenDeps): TaskEnqueuer {
  return async (jobId) => processGenerateMeal(jobId, deps);
}

export function makeMealGenRoutes(deps: {
  verify: TokenVerifier;
  engine: MealGenDeps['engine'];
  enqueue: TaskEnqueuer;
}): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post(
    '/generate',
    quotaGuard(GenerationType.MEAL),
    zValidator('json', zGenerateMealInput),
    async (c) => {
      const user = c.get('user');
      const input = c.req.valid('json');
      await incrementUsage(user.authId, GenerationType.MEAL, new Date());
      const job = await createJob(user.authId, GenerationType.MEAL, input);
      await deps.enqueue(job.id);
      return c.json(apiSuccess({ jobId: job.id }), 202);
    },
  );

  app.get('/jobs/:id', async (c) => {
    const user = c.get('user');
    const job = await findJobForUser(user.authId, c.req.param('id'));
    return c.json(apiSuccess(job));
  });

  app.get('/active', async (c) => {
    const user = c.get('user');
    const plan = await findActiveMealPlan(user.authId);
    return c.json(apiSuccess(plan));
  });

  return app;
}
