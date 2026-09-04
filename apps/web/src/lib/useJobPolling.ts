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
  /**
   * When set, the in-flight jobId is saved to localStorage under this key and
   * re-polled automatically on mount — so a page reload during generation
   * resumes the progress instead of losing it. Cleared on any terminal state.
   */
  persistKey?: string;
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

function readStored(key: string | undefined): string | undefined {
  if (!key) return undefined;
  try {
    return localStorage.getItem(key) ?? undefined;
  } catch {
    return undefined;
  }
}

function writeStored(key: string | undefined, jobId: string | undefined): void {
  if (!key) return;
  try {
    if (jobId) localStorage.setItem(key, jobId);
    else localStorage.removeItem(key);
  } catch {
    /* storage unavailable — non-fatal */
  }
}

function messageOf(err: unknown): string {
  return err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err);
}

export function useJobPolling<TResult, TInput = unknown>(
  options: UseJobPollingOptions<TInput, TResult>,
): UseJobPollingReturn<TInput, TResult> {
  const {
    start,
    poll,
    fetchResult,
    intervalMs = DEFAULT_INTERVAL_MS,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    persistKey,
  } = options;

  const [status, setStatus] = useState<JobPollingStatus>('idle');
  const [job, setJob] = useState<GenerationJob | undefined>(undefined);
  const [result, setResult] = useState<TResult | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);
  // Keep the latest callbacks so the mount-time resume effect never needs them
  // in its dependency array (which would re-fire it).
  const cbRef = useRef({ poll, fetchResult });
  cbRef.current = { poll, fetchResult };

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  // Poll an already-created job to completion. Shared by `run` (after start) and
  // the mount-time resume. Clears the persisted key on every terminal state.
  const pollLoop = useCallback(
    async (jobId: string, isCurrent: () => boolean): Promise<void> => {
      const { poll: pollFn, fetchResult: fetchFn } = cbRef.current;
      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        if (!isCurrent()) return;

        let currentJob: GenerationJob;
        try {
          currentJob = await pollFn(jobId);
        } catch (err) {
          if (!isCurrent()) return;
          writeStored(persistKey, undefined);
          setStatus('error');
          setError(messageOf(err));
          return;
        }

        if (!isCurrent()) return;
        setJob(currentJob);

        if (currentJob.status === JobStatus.DONE) {
          if (fetchFn) {
            try {
              const fetched = await fetchFn(currentJob);
              if (!isCurrent()) return;
              setResult(fetched);
            } catch (err) {
              if (!isCurrent()) return;
              writeStored(persistKey, undefined);
              setStatus('error');
              setError(messageOf(err));
              return;
            }
          }
          if (!isCurrent()) return;
          writeStored(persistKey, undefined);
          setStatus('done');
          return;
        }

        if (currentJob.status === JobStatus.FAILED) {
          writeStored(persistKey, undefined);
          setStatus('error');
          setError(currentJob.error ?? GENERIC_FAILURE_MESSAGE);
          return;
        }

        await wait(intervalMs);
      }

      if (!isCurrent()) return;
      writeStored(persistKey, undefined);
      setStatus('error');
      setError(TIMEOUT_MESSAGE);
    },
    [maxAttempts, intervalMs, persistKey],
  );

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
        setStatus('error');
        setError(messageOf(err));
        return;
      }

      if (!isCurrent()) return;
      writeStored(persistKey, jobId);
      setStatus('polling');
      await pollLoop(jobId, isCurrent);
    },
    [start, pollLoop, persistKey],
  );

  // On mount: if a job was in flight before a reload, resume polling it.
  useEffect(() => {
    const stored = readStored(persistKey);
    if (!stored) return;
    const runId = ++runIdRef.current;
    cancelledRef.current = false;
    const isCurrent = (): boolean => !cancelledRef.current && runIdRef.current === runId;
    setStatus('polling');
    void pollLoop(stored, isCurrent);
    // Intentionally run once on mount for this persistKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persistKey]);

  return { run, status, job, result, error };
}
