import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, GenerationType, zAnalyzeInbodyInput } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { quotaGuard } from '../subscription/quota.guard.js';
import { createJob, findJobForUser } from '../workout/generation-job.repo.js';
import type { TaskEnqueuer } from '../workout/workout-gen.routes.js';
import { processAnalyzeInbody, type InbodyDeps } from './inbody.service.js';
import { findLatestInbody } from './inbody.repo.js';
import type { VisionAnalyzer } from './vision.js';

export function inlineInbodyEnqueuer(deps: InbodyDeps): TaskEnqueuer {
  return async (jobId) => processAnalyzeInbody(jobId, deps);
}

export function makeInbodyRoutes(deps: {
  verify: TokenVerifier;
  analyzer: VisionAnalyzer;
  enqueue: TaskEnqueuer;
}): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post(
    '/analyze',
    quotaGuard(GenerationType.INBODY),
    zValidator('json', zAnalyzeInbodyInput),
    async (c) => {
      const user = c.get('user');
      const input = c.req.valid('json');
      const job = await createJob(user.authId, GenerationType.INBODY, input);
      await deps.enqueue(job.id);
      return c.json(apiSuccess({ jobId: job.id }), 202);
    },
  );

  app.get('/jobs/:id', async (c) => {
    const user = c.get('user');
    const job = await findJobForUser(user.authId, c.req.param('id'));
    return c.json(apiSuccess(job));
  });

  app.get('/latest', async (c) => {
    const user = c.get('user');
    const result = await findLatestInbody(user.authId);
    return c.json(apiSuccess(result));
  });

  return app;
}
