import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, PlanTemplateType, zCreatePlanInput, zUpdatePlanInput } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { findActivePlan, listPlans, findPlanById } from './workout.repo.js';
import { createPlanFromTemplate } from './preset-templates.js';
import { createPlan, updatePlan, activatePlan, removePlan, PlanError } from './plan.service.js';

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

  app.get('/', async (c) => {
    const plans = await listPlans(c.get('user').authId);
    return c.json(apiSuccess(plans));
  });

  app.post('/', zValidator('json', zCreatePlanInput), async (c) => {
    const input = c.req.valid('json');
    try {
      const plan = await createPlan(c.get('user').authId, input);
      return c.json(apiSuccess(plan), 201);
    } catch (err) {
      if (err instanceof PlanError) return c.json(errorBody(err.message), err.status as 400 | 404);
      throw err;
    }
  });

  app.get('/:id', async (c) => {
    const plan = await findPlanById(c.get('user').authId, c.req.param('id'));
    if (!plan) return c.json(errorBody('Plan not found'), 404);
    return c.json(apiSuccess(plan));
  });

  app.put('/:id', zValidator('json', zUpdatePlanInput), async (c) => {
    const input = c.req.valid('json');
    try {
      const plan = await updatePlan(c.get('user').authId, c.req.param('id'), input);
      return c.json(apiSuccess(plan));
    } catch (err) {
      if (err instanceof PlanError) return c.json(errorBody(err.message), err.status as 400 | 404);
      throw err;
    }
  });

  app.post('/:id/activate', async (c) => {
    try {
      const plan = await activatePlan(c.get('user').authId, c.req.param('id'));
      return c.json(apiSuccess(plan));
    } catch (err) {
      if (err instanceof PlanError) return c.json(errorBody(err.message), err.status as 400 | 404);
      throw err;
    }
  });

  app.delete('/:id', async (c) => {
    try {
      await removePlan(c.get('user').authId, c.req.param('id'));
      return c.json(apiSuccess({ deleted: true }));
    } catch (err) {
      if (err instanceof PlanError) return c.json(errorBody(err.message), err.status as 400 | 404);
      throw err;
    }
  });

  return app;
}
