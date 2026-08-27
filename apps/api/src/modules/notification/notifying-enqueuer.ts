import { JobStatus } from '@gigaflow/shared';
import type { TaskEnqueuer } from '../workout/workout-gen.routes.js';
import { findJobById } from '../workout/generation-job.repo.js';
import { notifyJobComplete, notifyJobError, type JobKind, type NotifyDeps } from './notification.service.js';

export function notifyingEnqueuer(inner: TaskEnqueuer, kind: JobKind, deps: NotifyDeps): TaskEnqueuer {
  return async (jobId: string): Promise<void> => {
    try {
      await inner(jobId);
    } finally {
      try {
        const job = await findJobById(jobId);
        if (job) {
          if (job.status === JobStatus.DONE) {
            await notifyJobComplete(job.userId, kind, deps);
          } else if (job.status === JobStatus.FAILED) {
            await notifyJobError(job.userId, kind, deps);
          }
        }
      } catch {
        // swallow — notification failures must never affect job processing
      }
    }
  };
}
