import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, zLogWeightInput } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { logWeight, listWeights } from './weight.repo.js';

export function makeWeightRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post('/', zValidator('json', zLogWeightInput), async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    const log = await logWeight(user.authId, input.weightKg, input.loggedAt);
    return c.json(apiSuccess(log), 201);
  });

  app.get('/history', async (c) => {
    const user = c.get('user');
    const logs = await listWeights(user.authId);
    return c.json(apiSuccess(logs));
  });

  return app;
}
