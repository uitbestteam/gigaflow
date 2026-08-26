import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, zLogSetInput } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { findActiveSession } from './session.repo.js';
import {
  startSession, logSets, finishSession, cancelSession, lastForExercise, SessionError,
} from './session.service.js';

const startBody = z.object({ templateId: z.string() });
const setsBody = z.object({ sets: z.array(zLogSetInput) });

export function makeSessionRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.post('/start', zValidator('json', startBody), async (c) => {
    const { templateId } = c.req.valid('json');
    try {
      const result = await startSession(c.get('user').authId, templateId);
      return c.json(apiSuccess(result), 201);
    } catch (err) {
      if (err instanceof SessionError) return c.json(errorBody(err.message), err.status as 404 | 409);
      throw err;
    }
  });

  app.get('/active', async (c) => {
    const session = await findActiveSession(c.get('user').authId);
    return c.json(apiSuccess(session));
  });

  app.post('/:id/sets', zValidator('json', setsBody), async (c) => {
    const { sets } = c.req.valid('json');
    try {
      const setLogs = await logSets(c.get('user').authId, c.req.param('id'), sets);
      return c.json(apiSuccess(setLogs));
    } catch (err) {
      if (err instanceof SessionError) return c.json(errorBody(err.message), err.status as 404 | 409);
      throw err;
    }
  });

  app.post('/:id/finish', async (c) => {
    try {
      const session = await finishSession(c.get('user').authId, c.req.param('id'));
      return c.json(apiSuccess(session));
    } catch (err) {
      if (err instanceof SessionError) return c.json(errorBody(err.message), err.status as 404 | 409);
      throw err;
    }
  });

  app.post('/:id/cancel', async (c) => {
    try {
      const session = await cancelSession(c.get('user').authId, c.req.param('id'));
      return c.json(apiSuccess(session));
    } catch (err) {
      if (err instanceof SessionError) return c.json(errorBody(err.message), err.status as 404 | 409);
      throw err;
    }
  });

  return app;
}

export function makeLastPerfRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.get('/:id/last', async (c) => {
    const perf = await lastForExercise(c.get('user').authId, c.req.param('id'));
    return c.json(apiSuccess(perf));
  });

  return app;
}
