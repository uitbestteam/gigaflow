import type { TaskEnqueuer } from '../modules/workout/workout-gen.routes.js';

/**
 * Wrap an enqueuer so the HTTP handler returns immediately instead of blocking
 * on the (inline) job processing: the request creates the job, schedules the
 * work in the background, and responds 202 right away, so the client can poll
 * the job status. The inner enqueuer already records job failure, so we only
 * swallow the rejection here to avoid an unhandled promise.
 *
 * On Cloud Run this needs "CPU always allocated" (cpu_idle = false) for the
 * background promise to run to completion after the response is sent. The
 * durable alternative is real Cloud Tasks hitting the internal task routes.
 */
export function backgroundEnqueuer(inner: TaskEnqueuer): TaskEnqueuer {
  return (jobId) => {
    void inner(jobId).catch((err: unknown) => {
      console.error(`[background job ${jobId}] failed:`, err);
    });
    return Promise.resolve();
  };
}
