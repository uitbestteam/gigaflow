import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, zRegisterDeviceTokenInput } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { upsertDeviceToken, deleteDeviceToken } from './device-token.repo.js';

export function makeDeviceTokenRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post('/device-token', zValidator('json', zRegisterDeviceTokenInput), async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    const token = await upsertDeviceToken(user.authId, input.token, input.platform);
    return c.json(apiSuccess(token), 201);
  });

  app.delete('/device-token/:token', async (c) => {
    const user = c.get('user');
    const deleted = await deleteDeviceToken(user.authId, c.req.param('token'));
    return c.json(apiSuccess({ deleted }));
  });

  return app;
}
