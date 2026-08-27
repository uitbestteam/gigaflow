import type { ZodType } from 'zod';
import {
  zUser,
  zPlanWithTemplates,
  zSessionStartResult,
  zTrainingSession,
  zSetLog,
  zPersonalRecord,
  zExercise,
  type User,
  type PlanWithTemplates,
  type SessionStartResult,
  type TrainingSession,
  type SetLog,
  type PersonalRecord,
  type LogSetInput,
  type PlanTemplateType,
  type Exercise,
} from '@gigaflow/shared';

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

interface ApiConfig {
  getToken: () => string | undefined | null;
  onUnauthorized: () => Promise<void> | void;
  baseUrl: string;
}

const DEFAULT_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '/api';

let config: ApiConfig = {
  getToken: () => undefined,
  onUnauthorized: () => {},
  baseUrl: DEFAULT_BASE_URL,
};

export function configureApi(opts: {
  getToken: () => string | undefined | null;
  onUnauthorized: () => Promise<void> | void;
  baseUrl?: string;
}): void {
  config = {
    getToken: opts.getToken,
    onUnauthorized: opts.onUnauthorized,
    baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
  };
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  message?: string;
}

// The API serializes Date fields (e.g. createdAt) to ISO-8601 strings via
// JSON.stringify. The shared Zod schemas declare those fields as z.date(),
// which only accepts real Date instances — so we revive ISO date strings
// back into Dates before schema.parse runs.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

async function parseEnvelope<T>(res: Response): Promise<ApiEnvelope<T>> {
  const text = await res.text();
  if (!text) return { success: res.ok };
  return JSON.parse(text, reviveDates) as ApiEnvelope<T>;
}

export interface ApiFetchOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  schema?: ZodType<T>;
  fetchImpl?: typeof fetch;
}

export async function apiFetch<T>(path: string, opts: ApiFetchOptions<T> = {}): Promise<T> {
  return runFetch(path, opts, true);
}

function resolveUrl(path: string): string {
  const raw = `${config.baseUrl}${path}`;
  try {
    // Already an absolute URL (e.g. VITE_API_BASE_URL set to a full origin).
    return new URL(raw).toString();
  } catch {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'http://localhost';
    return new URL(raw, origin).toString();
  }
}

async function runFetch<T>(path: string, opts: ApiFetchOptions<T>, allowRetry: boolean): Promise<T> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = config.getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetchImpl(resolveUrl(path), {
    method: opts.method ?? 'GET',
    headers,
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  });

  const json = await parseEnvelope<T>(res);

  if (res.status === 401 && allowRetry) {
    await config.onUnauthorized();
    return runFetch(path, opts, false);
  }

  if (!res.ok || !json.success) {
    throw new ApiError(res.status, json.message ?? 'Request failed');
  }

  if (opts.schema) {
    return opts.schema.parse(json.data);
  }
  return json.data as T;
}

export async function postAuthSession(): Promise<User> {
  return apiFetch('/auth/session', { method: 'POST', schema: zUser });
}

export async function getActivePlan(): Promise<PlanWithTemplates | null> {
  return apiFetch('/plans/active', { schema: zPlanWithTemplates.nullable() });
}

export async function createPlanFromTemplate(templateType: PlanTemplateType): Promise<PlanWithTemplates> {
  return apiFetch('/plans/from-template', {
    method: 'POST',
    body: { templateType },
    schema: zPlanWithTemplates,
  });
}

export async function startSession(templateId: string): Promise<SessionStartResult> {
  return apiFetch('/sessions/start', {
    method: 'POST',
    body: { templateId },
    schema: zSessionStartResult,
  });
}

export async function getSession(): Promise<TrainingSession | null> {
  return apiFetch('/sessions/active', { schema: zTrainingSession.nullable() });
}

export async function logSets(id: string, sets: LogSetInput[]): Promise<SetLog[]> {
  return apiFetch(`/sessions/${id}/sets`, {
    method: 'POST',
    body: { sets },
    schema: zSetLog.array(),
  });
}

export async function finishSession(id: string): Promise<TrainingSession> {
  return apiFetch(`/sessions/${id}/finish`, { method: 'POST', schema: zTrainingSession });
}

export async function cancelSession(id: string): Promise<TrainingSession> {
  return apiFetch(`/sessions/${id}/cancel`, { method: 'POST', schema: zTrainingSession });
}

export async function getPrs(): Promise<PersonalRecord[]> {
  return apiFetch('/stats/prs', { schema: zPersonalRecord.array() });
}

export async function getExercises(): Promise<Exercise[]> {
  return apiFetch('/exercises', { schema: zExercise.array() });
}
