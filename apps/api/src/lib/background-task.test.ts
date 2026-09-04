import { describe, it, expect, vi } from 'vitest';
import { backgroundEnqueuer } from './background-task.js';

describe('backgroundEnqueuer', () => {
  it('returns immediately and runs the inner enqueuer in the background', async () => {
    let innerDone = false;
    let resolveInner: () => void = () => {};
    const innerFinished = new Promise<void>((r) => (resolveInner = r));

    const inner = vi.fn(async (jobId: string) => {
      expect(jobId).toBe('job_1');
      await innerFinished;
      innerDone = true;
    });

    // Awaiting the wrapped enqueuer must NOT wait for inner to finish.
    await backgroundEnqueuer(inner)('job_1');
    expect(inner).toHaveBeenCalledWith('job_1');
    expect(innerDone).toBe(false);

    resolveInner();
    await innerFinished;
    // let the background microtask settle
    await Promise.resolve();
    expect(innerDone).toBe(true);
  });

  it('swallows a rejecting inner (no unhandled rejection)', async () => {
    const inner = vi.fn(async () => {
      throw new Error('boom');
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(backgroundEnqueuer(inner)('job_2')).resolves.toBeUndefined();
    await Promise.resolve();
    await Promise.resolve();

    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
