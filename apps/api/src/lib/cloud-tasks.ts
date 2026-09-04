import { CloudTasksClient } from '@google-cloud/tasks';
import type { TaskEnqueuer } from '../modules/workout/workout-gen.routes.js';

export interface CloudTasksConfig {
  project: string;
  location: string;
  queue: string;
  /** Absolute URL of the internal task handler this queue should POST to. */
  targetUrl: string;
}

let client: CloudTasksClient | undefined;
function getClient(): CloudTasksClient {
  return (client ??= new CloudTasksClient());
}

/**
 * Enqueue job processing onto a Cloud Tasks queue. The task is delivered as a
 * separate authenticated HTTP request to `targetUrl` (an /internal/tasks route)
 * carrying `{ jobId }` — so processing runs under its own request with CPU
 * allocated, keeping the public endpoint fast and Cloud Run request-billed
 * (no cpu-always-on). Cloud Tasks handles retries + durability.
 */
export function cloudTasksEnqueuer(cfg: CloudTasksConfig): TaskEnqueuer {
  return async (jobId: string): Promise<void> => {
    const c = getClient();
    const parent = c.queuePath(cfg.project, cfg.location, cfg.queue);
    await c.createTask({
      parent,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: cfg.targetUrl,
          headers: { 'Content-Type': 'application/json' },
          body: Buffer.from(JSON.stringify({ jobId })).toString('base64'),
        },
      },
    });
  };
}
