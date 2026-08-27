import { Hono } from 'hono';
import { apiSuccess } from '@gigaflow/shared';
import { internalAuth } from '../../middleware/internal-auth.js';
import { sendWorkoutReminders } from './reminder.service.js';
import type { PushSender } from './push-sender.js';

export function makeCronRoutes(deps: { sender: PushSender }): Hono {
  const app = new Hono();
  app.use('*', internalAuth());

  app.post('/workout-reminders', async (c) => {
    const result = await sendWorkoutReminders(new Date(), { sender: deps.sender });
    return c.json(apiSuccess(result));
  });

  return app;
}
