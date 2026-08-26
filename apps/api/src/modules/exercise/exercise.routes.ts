import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { apiSuccess, zCreateExerciseInput, MuscleGroup } from '@gigaflow/shared';
import { errorBody } from '../../middleware/error.js';
import { firebaseAuth, type TokenVerifier } from '../auth/firebase-auth.js';
import { listVisible, createCustom, ExerciseConflictError } from './exercise.repo.js';

function parseMuscleGroup(v: string | undefined): MuscleGroup | undefined {
  return v && (Object.values(MuscleGroup) as string[]).includes(v) ? (v as MuscleGroup) : undefined;
}

export function makeExerciseRoutes(deps: { verify: TokenVerifier }): Hono {
  const app = new Hono();
  app.use('*', firebaseAuth({ verify: deps.verify }));

  app.get('/', async (c) => {
    const user = c.get('user');
    const list = await listVisible(user.authId, {
      muscleGroup: parseMuscleGroup(c.req.query('muscleGroup')),
      q: c.req.query('q'),
    });
    return c.json(apiSuccess(list));
  });

  app.post('/', zValidator('json', zCreateExerciseInput), async (c) => {
    const user = c.get('user');
    const input = c.req.valid('json');
    try {
      const created = await createCustom(user.authId, input);
      return c.json(apiSuccess(created), 201);
    } catch (err) {
      if (err instanceof ExerciseConflictError) return c.json(errorBody('Exercise already exists'), 409);
      throw err;
    }
  });

  return app;
}
