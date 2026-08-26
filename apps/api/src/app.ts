import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error.js';
import { internalAuth } from './middleware/internal-auth.js';
import { health } from './modules/health/health.routes.js';
import { makeAuthRoutes } from './modules/auth/auth.routes.js';
import { makeExerciseRoutes } from './modules/exercise/exercise.routes.js';
import { makeWorkoutRoutes } from './modules/workout/workout.routes.js';
import { makeSessionRoutes, makeLastPerfRoutes } from './modules/training/session.routes.js';
import { firebaseVerifier } from './lib/firebase.js';

export function createApp(): Hono {
  const app = new Hono().basePath('/api');
  app.use('*', logger());
  app.route('/health', health);
  app.use('/internal/*', internalAuth());
  app.get('/internal/tasks/ping', (c) => c.json({ success: true, data: { pong: true } }));
  app.route('/auth', makeAuthRoutes({ verify: firebaseVerifier }));
  app.route('/exercises', makeExerciseRoutes({ verify: firebaseVerifier }));
  app.route('/plans', makeWorkoutRoutes({ verify: firebaseVerifier }));
  app.route('/sessions', makeSessionRoutes({ verify: firebaseVerifier }));
  app.route('/exercises', makeLastPerfRoutes({ verify: firebaseVerifier }));
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
