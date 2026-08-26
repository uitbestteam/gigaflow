import { Hono, type Context } from 'hono';
import { apiSuccess } from '@gigaflow/shared';
import { firebaseAuth, type TokenVerifier } from './firebase-auth.js';

export function makeAuthRoutes(deps: { verify: TokenVerifier }): Hono {
  const auth = new Hono();
  auth.use('*', firebaseAuth({ verify: deps.verify }));
  const handler = (c: Context) => c.json(apiSuccess(c.get('user')));
  auth.get('/session', handler);
  auth.post('/session', handler);
  return auth;
}
