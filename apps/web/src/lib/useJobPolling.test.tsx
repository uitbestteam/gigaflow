import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { JobStatus, GenerationType, type GenerationJob } from '@gigaflow/shared';
import { ApiError } from './api';
import { useJobPolling } from './useJobPolling';

function makeJob(overrides: Partial<GenerationJob>): GenerationJob {
  return {
    id: 'job-1',
    userId: 'u1',
    type: GenerationType.WORKOUT,
    status: JobStatus.QUEUED,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useJobPolling', () => {
  it('runs start -> polls -> done, calling fetchResult and setting result', async () => {
    const start = vi.fn(async () => ({ jobId: 'job-1' }));
    const poll = vi
      .fn<(jobId: string) => Promise<GenerationJob>>()
      .mockResolvedValueOnce(makeJob({ status: JobStatus.PROCESSING }))
      .mockResolvedValueOnce(makeJob({ status: JobStatus.DONE, resultId: 'res-1' }));
    const fetchResult = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useJobPolling<{ ok: boolean }>({ start, poll, fetchResult, intervalMs: 1000 }),
    );

    expect(result.current.status).toBe('idle');

    await act(async () => {
      void result.current.run({ any: 'input' });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('polling');
    expect(start).toHaveBeenCalledWith({ any: 'input' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.status).toBe('done');
    expect(result.current.result).toEqual({ ok: true });
    expect(fetchResult).toHaveBeenCalledWith(expect.objectContaining({ status: JobStatus.DONE }));
  });

  it('sets error from job.error when poll returns failed status, without calling fetchResult', async () => {
    const start = vi.fn(async () => ({ jobId: 'job-1' }));
    const poll = vi.fn(async () => makeJob({ status: JobStatus.FAILED, error: 'boom' }));
    const fetchResult = vi.fn(async () => ({ ok: true }));

    const { result } = renderHook(() =>
      useJobPolling<{ ok: boolean }>({ start, poll, fetchResult, intervalMs: 1000 }),
    );

    await act(async () => {
      void result.current.run({});
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('boom');
    expect(fetchResult).not.toHaveBeenCalled();
  });

  it('sets error from ApiError message when start rejects (e.g. quota)', async () => {
    const start = vi.fn(async () => {
      throw new ApiError(429, 'Quota exceeded');
    });
    const poll = vi.fn(async () => makeJob({ status: JobStatus.DONE }));

    const { result } = renderHook(() => useJobPolling<{ ok: boolean }>({ start, poll }));

    await act(async () => {
      void result.current.run({});
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('Quota exceeded');
    expect(poll).not.toHaveBeenCalled();
  });

  it('stops polling after unmount without further state updates', async () => {
    const start = vi.fn(async () => ({ jobId: 'job-1' }));
    const poll = vi.fn(async () => makeJob({ status: JobStatus.PROCESSING }));

    const { result, unmount } = renderHook(() => useJobPolling<{ ok: boolean }>({ start, poll, intervalMs: 1000 }));

    await act(async () => {
      void result.current.run({});
      await Promise.resolve();
      await Promise.resolve();
    });

    const callsBeforeUnmount = poll.mock.calls.length;
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    // poll should not be called (much) more after unmount — cancellation stops the loop.
    expect(poll.mock.calls.length).toBeLessThanOrEqual(callsBeforeUnmount + 1);
  });
});
