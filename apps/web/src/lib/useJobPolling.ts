import { useCallback, useEffect, useRef, useState } from 'react';
import { JobStatus, type GenerationJob } from '@gigaflow/shared';
import { ApiError } from './api';

export type JobPollingStatus = 'idle' | 'submitting' | 'polling' | 'done' | 'error';

const DEFAULT_INTERVAL_MS = 1500;
const DEFAULT_MAX_ATTEMPTS = 40;
const GENERIC_FAILURE_MESSAGE = 'Generation failed';
const TIMEOUT_MESSAGE = 'Timed out waiting for the job to complete';

export interface UseJobPollingOptions<TInput, TResult> {
  start: (input: TInput) => Promise<{ jobId: string }>;
  poll: (jobId: string) => Promise<GenerationJob>;
  fetchResult?: (job: GenerationJob) => Promise<TResult>;
  intervalMs?: number;
  maxAttempts?: number;
}

export interface UseJobPollingReturn<TInput, TResult> {
  run: (input: TInput) => Promise<void>;
  status: JobPollingStatus;
  job?: GenerationJob;
  result?: TResult;
  error?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function useJobPolling<TResult, TInput = unknown>(
  options: UseJobPollingOptions<TInput, TResult>,
): UseJobPollingReturn<TInput, TResult> {
  const { start, poll, fetchResult, intervalMs = DEFAULT_INTERVAL_MS, maxAttempts = DEFAULT_MAX_ATTEMPTS } = options;

  const [status, setStatus] = useState<JobPollingStatus>('idle');
  const [job, setJob] = useState<GenerationJob | undefined>(undefined);
  const [result, setResult] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const run = useCallback(
    async (input: TInput): Promise<void> => {
      const runId = ++runIdRef.current;
      cancelledRef.current = false;
      const isCurrent = (): boolean => !cancelledRef.current && runIdRef.current === runId;

      setStatus('submitting');
      setJob(undefined);
      setResult(undefined);
      setError(undefined);

      let jobId: string;
      try {
        const started = await start(input);
        jobId = started.jobId;
      } catch (err) {
        if (!isCurrent()) return;
        const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
        setStatus('error');
        setError(message);
        return;
      }

      if (!isCurrent()) return;
      setStatus('polling');

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isCurrent()) return;

        let currentJob: GenerationJob;
        try {
          currentJob = await poll(jobId);
        } catch (err) {
          if (!isCurrent()) return;
          const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
          setStatus('error');
          setError(message);
          return;
        }

        if (!isCurrent()) return;
        setJob(currentJob);

        if (currentJob.status === JobStatus.DONE) {
          if (fetchResult) {
            try {
              const fetched = await fetchResult(currentJob);
              if (!isCurrent()) return;
              setResult(fetched);
            } catch (err) {
              if (!isCurrent()) return;
              const message = err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
              setStatus('error');
              setError(message);
              return;
            }
          }
          if (!isCurrent()) return;
          setStatus('done');
          return;
        }

        if (currentJob.status === JobStatus.FAILED) {
          setStatus('error');
          setError(currentJob.error ?? GENERIC_FAILURE_MESSAGE);
          return;
        }

        await wait(intervalMs);
      }

      if (!isCurrent()) return;
      setStatus('error');
      setError(TIMEOUT_MESSAGE);
    },
    [start, poll, fetchResult, intervalMs, maxAttempts],
  );

  return { run, status, job, result, error };
}
