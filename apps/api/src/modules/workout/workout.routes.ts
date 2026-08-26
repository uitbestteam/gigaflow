import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, PlanTemplateType } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { findActivePlan } from './workout.repo.js';
import { createPlanFromTemplate } from './preset-templates.js';

const fromTemplateBody = z.object({ templateType: z.nativeEnum(PlanTemplateType) });

export function makeWorkoutRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.get('/active', async (c) => {
    const plan = await findActivePlan(c.get('user').authId);
    return c.json(apiSuccess(plan));
  });

  app.post('/from-template', zValidator('json', fromTemplateBody), async (c) => {
    const { templateType } = c.req.valid('json');
    try {
      const plan = await createPlanFromTemplate(c.get('user').authId, templateType);
      return c.json(apiSuccess(plan), 201);
    } catch (err) {
      if (err instanceof Error && err.message === 'Unknown preset template') {
        return c.json(errorBody('Unknown preset template'), 400);
      }
      throw err;
    }
  });

  return app;
}
