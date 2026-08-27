import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error.js';
import { health } from './modules/health/health.routes.js';
import { makeAuthRoutes } from './modules/auth/auth.routes.js';
import { makeExerciseRoutes } from './modules/exercise/exercise.routes.js';
import { makeWorkoutRoutes } from './modules/workout/workout.routes.js';
import { makeWorkoutGenRoutes, makeInternalTaskRoutes, inlineEnqueuer } from './modules/workout/workout-gen.routes.js';
import { makeMealGenRoutes, inlineMealEnqueuer } from './modules/nutrition/meal-gen.routes.js';
import { makeSessionRoutes, makeLastPerfRoutes } from './modules/training/session.routes.js';
import { firebaseVerifier } from './lib/firebase.js';
import { buildAiEngine, buildMealAiEngine } from './modules/ai/ai.factory.js';

export function createApp(): Hono {
  const app = new Hono().basePath('/api');
  const engine = buildAiEngine();
  const mealEngine = buildMealAiEngine();
  app.use('*', logger());
  app.route('/health', health);
  app.route('/auth', makeAuthRoutes({ verify: firebaseVerifier }));
  app.route('/exercises', makeExerciseRoutes({ verify: firebaseVerifier }));
  app.route('/plans', makeWorkoutRoutes({ verify: firebaseVerifier }));
  app.route('/sessions', makeSessionRoutes({ verify: firebaseVerifier }));
  app.route('/exercises', makeLastPerfRoutes({ verify: firebaseVerifier }));
  app.route('/workout', makeWorkoutGenRoutes({
    verify: firebaseVerifier,
    engine,
    enqueue: inlineEnqueuer({ engine }),
  }));
  app.route('/internal/tasks', makeInternalTaskRoutes({ engine }));
  app.route('/meal', makeMealGenRoutes({
    verify: firebaseVerifier,
    engine: mealEngine,
    enqueue: inlineMealEnqueuer({ engine: mealEngine }),
  }));
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
