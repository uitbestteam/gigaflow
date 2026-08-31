import { z, type ZodType } from 'zod';
import {
  zUser,
  zPlan,
  zPlanWithTemplates,
  zSessionStartResult,
  zTrainingSession,
  zSetLog,
  zPersonalRecord,
  zExercise,
  MuscleGroup,
  zGenerationJob,
  zMealPlanDoc,
  zInbodyResult,
  zStatsSummary,
  zAward,
  zWeightLog,
  type User,
  type Plan,
  type PlanWithTemplates,
  type CreatePlanInput,
  type UpdatePlanInput,
  type SessionStartResult,
  type TrainingSession,
  type SetLog,
  type PersonalRecord,
  type LogSetInput,
  type PlanTemplateType,
  type Exercise,
  type CreateExerciseInput,
  type GenerateWorkoutInput,
  type GenerationJob,
  type GenerateMealInput,
  type MealPlanDoc,
  type AnalyzeInbodyInput,
  type InbodyResult,
  type StatsSummary,
  type Award,
  type LogWeightInput,
  type WeightLog,
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

export async function getExercises(
  params?: { q?: string; muscleGroup?: MuscleGroup },
  fetchImpl?: typeof fetch,
): Promise<Exercise[]> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.muscleGroup) search.set('muscleGroup', params.muscleGroup);
  const qs = search.toString();
  return apiFetch(`/exercises${qs ? `?${qs}` : ''}`, { schema: zExercise.array(), fetchImpl });
}

export async function createExercise(input: CreateExerciseInput, fetchImpl?: typeof fetch): Promise<Exercise> {
  return apiFetch('/exercises', { method: 'POST', body: input, schema: zExercise, fetchImpl });
}

export async function getPlans(fetchImpl?: typeof fetch): Promise<Plan[]> {
  return apiFetch('/plans', { schema: zPlan.array(), fetchImpl });
}

export async function getPlan(id: string, fetchImpl?: typeof fetch): Promise<PlanWithTemplates> {
  return apiFetch(`/plans/${id}`, { schema: zPlanWithTemplates, fetchImpl });
}

export async function createPlan(input: CreatePlanInput, fetchImpl?: typeof fetch): Promise<PlanWithTemplates> {
  return apiFetch('/plans', { method: 'POST', body: input, schema: zPlanWithTemplates, fetchImpl });
}

export async function updatePlan(
  id: string,
  input: UpdatePlanInput,
  fetchImpl?: typeof fetch,
): Promise<PlanWithTemplates> {
  return apiFetch(`/plans/${id}`, { method: 'PUT', body: input, schema: zPlanWithTemplates, fetchImpl });
}

export async function activatePlan(id: string, fetchImpl?: typeof fetch): Promise<PlanWithTemplates> {
  return apiFetch(`/plans/${id}/activate`, { method: 'POST', schema: zPlanWithTemplates, fetchImpl });
}

export async function deletePlan(id: string, fetchImpl?: typeof fetch): Promise<{ deleted: boolean }> {
  return apiFetch(`/plans/${id}`, {
    method: 'DELETE',
    schema: z.object({ deleted: z.boolean() }),
    fetchImpl,
  });
}

const zJobId = z.object({ jobId: z.string() });

export async function generateWorkout(
  input: GenerateWorkoutInput,
  fetchImpl?: typeof fetch,
): Promise<{ jobId: string }> {
  return apiFetch('/workout/generate', { method: 'POST', body: input, schema: zJobId, fetchImpl });
}

export async function getGenerationJob(id: string, fetchImpl?: typeof fetch): Promise<GenerationJob> {
  return apiFetch(`/workout/jobs/${id}`, { schema: zGenerationJob, fetchImpl });
}

export async function generateMeal(
  input: GenerateMealInput,
  fetchImpl?: typeof fetch,
): Promise<{ jobId: string }> {
  return apiFetch('/meal/generate', { method: 'POST', body: input, schema: zJobId, fetchImpl });
}

export async function getMealJob(id: string, fetchImpl?: typeof fetch): Promise<GenerationJob> {
  return apiFetch(`/meal/jobs/${id}`, { schema: zGenerationJob, fetchImpl });
}

export async function getActiveMeal(fetchImpl?: typeof fetch): Promise<MealPlanDoc | null> {
  return apiFetch('/meal/active', { schema: zMealPlanDoc.nullable(), fetchImpl });
}

export async function analyzeInbody(
  input: AnalyzeInbodyInput,
  fetchImpl?: typeof fetch,
): Promise<{ jobId: string }> {
  return apiFetch('/inbody/analyze', { method: 'POST', body: input, schema: zJobId, fetchImpl });
}

export async function getInbodyJob(id: string, fetchImpl?: typeof fetch): Promise<GenerationJob> {
  return apiFetch(`/inbody/jobs/${id}`, { schema: zGenerationJob, fetchImpl });
}

export async function getLatestInbody(fetchImpl?: typeof fetch): Promise<InbodyResult | null> {
  return apiFetch('/inbody/latest', { schema: zInbodyResult.nullable(), fetchImpl });
}

export async function getStatsSummary(fetchImpl?: typeof fetch): Promise<StatsSummary> {
  return apiFetch('/stats/summary', { schema: zStatsSummary, fetchImpl });
}

export async function getAwards(fetchImpl?: typeof fetch): Promise<Award[]> {
  return apiFetch('/stats/awards', { schema: zAward.array(), fetchImpl });
}

export async function logWeight(input: LogWeightInput, fetchImpl?: typeof fetch): Promise<WeightLog> {
  return apiFetch('/weight', { method: 'POST', body: input, schema: zWeightLog, fetchImpl });
}

export async function getWeightHistory(fetchImpl?: typeof fetch): Promise<WeightLog[]> {
  return apiFetch('/weight/history', { schema: zWeightLog.array(), fetchImpl });
}
