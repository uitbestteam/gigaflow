import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error.js';
import { requestId } from './middleware/request-id.js';
import { health } from './modules/health/health.routes.js';
import { makeAuthRoutes } from './modules/auth/auth.routes.js';
import { makeExerciseRoutes } from './modules/exercise/exercise.routes.js';
import { makeWorkoutRoutes } from './modules/workout/workout.routes.js';
import {
  makeWorkoutGenRoutes,
  makeInternalTaskRoutes,
  inlineEnqueuer,
  type TaskEnqueuer,
} from './modules/workout/workout-gen.routes.js';
import { makeMealGenRoutes, inlineMealEnqueuer } from './modules/nutrition/meal-gen.routes.js';
import { makeSessionRoutes, makeLastPerfRoutes } from './modules/training/session.routes.js';
import { makeStatsRoutes } from './modules/stats/stats.routes.js';
import { makeInbodyRoutes, inlineInbodyEnqueuer } from './modules/inbody/inbody.routes.js';
import { buildInbodyAnalyzer } from './modules/inbody/vision.factory.js';
import { makeWeightRoutes } from './modules/weight/weight.routes.js';
import { makeDeviceTokenRoutes } from './modules/notification/device-token.routes.js';
import { makeCronRoutes } from './modules/notification/cron.routes.js';
import { firebaseVerifier } from './lib/firebase.js';
import { buildAiEngine, buildMealAiEngine } from './modules/ai/ai.factory.js';
import { buildPushSender } from './modules/notification/push-sender.factory.js';
import { notifyingEnqueuer } from './modules/notification/notifying-enqueuer.js';
import { backgroundEnqueuer } from './lib/background-task.js';
import { cloudTasksEnqueuer } from './lib/cloud-tasks.js';

export function createApp(): Hono {
  const app = new Hono().basePath('/api');
  const engine = buildAiEngine();
  const mealEngine = buildMealAiEngine();
  const inbodyAnalyzer = buildInbodyAnalyzer();
  const pushSender = buildPushSender();

  // Each job kind has a fully-wired processor: inline generation + completion
  // push notification. These run inside the internal task routes (invoked by
  // Cloud Tasks) OR, in the local fallback, in the background of the request.
  const procWorkout: TaskEnqueuer = notifyingEnqueuer(inlineEnqueuer({ engine }), 'workout', { sender: pushSender });
  const procMeal: TaskEnqueuer = notifyingEnqueuer(inlineMealEnqueuer({ engine: mealEngine }), 'meal', { sender: pushSender });
  const procInbody: TaskEnqueuer = notifyingEnqueuer(inlineInbodyEnqueuer({ analyzer: inbodyAnalyzer }), 'inbody', { sender: pushSender });

  // Enqueue strategy: with Cloud Tasks configured (prod), the public endpoint
  // creates a task that hits the internal route in a SEPARATE request — keeping
  // Cloud Run request-billed (no cpu-always-on) and adding retries/durability.
  // Without it (local/tests), fall back to background in-process execution.
  const tasksBaseUrl = process.env.TASKS_TARGET_BASE_URL;
  const tasksProject = process.env.GCP_PROJECT_ID;
  const tasksLocation = process.env.TASKS_LOCATION ?? 'asia-southeast1';
  const enqueuerFor = (queue: string, path: string, fallback: TaskEnqueuer): TaskEnqueuer =>
    tasksBaseUrl && tasksProject
      ? cloudTasksEnqueuer({ project: tasksProject, location: tasksLocation, queue, targetUrl: `${tasksBaseUrl}${path}` })
      : backgroundEnqueuer(fallback);

  app.use('*', requestId());
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
    enqueue: enqueuerFor('workout-gen', '/api/internal/tasks/generate-workout', procWorkout),
  }));
  app.route('/internal/tasks', makeInternalTaskRoutes({ processWorkout: procWorkout, processMeal: procMeal, processInbody: procInbody }));
  app.route('/meal', makeMealGenRoutes({
    verify: firebaseVerifier,
    engine: mealEngine,
    enqueue: enqueuerFor('meal-gen', '/api/internal/tasks/generate-meal', procMeal),
  }));
  app.route('/stats', makeStatsRoutes({ verify: firebaseVerifier }));
  app.route('/inbody', makeInbodyRoutes({
    verify: firebaseVerifier,
    analyzer: inbodyAnalyzer,
    enqueue: enqueuerFor('inbody-ocr', '/api/internal/tasks/analyze-inbody', procInbody),
  }));
  app.route('/weight', makeWeightRoutes({ verify: firebaseVerifier }));
  app.route('/notifications', makeDeviceTokenRoutes({ verify: firebaseVerifier }));
  app.route('/internal/cron', makeCronRoutes({ sender: pushSender }));
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
