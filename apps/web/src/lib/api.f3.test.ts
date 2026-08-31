import { describe, it, expect, beforeEach } from 'vitest';
import { Goal, ExperienceLevel, Gender, ActivityLevel, ImageMimeType } from '@gigaflow/shared';
import { configureApi } from './api';
import {
  generateWorkout,
  getGenerationJob,
  generateMeal,
  getMealJob,
  getActiveMeal,
  analyzeInbody,
  getInbodyJob,
  getLatestInbody,
  getStatsSummary,
  getAwards,
  logWeight,
  getWeightHistory,
} from './api';

beforeEach(() => {
  configureApi({ getToken: () => 'tok', onUnauthorized: async () => {}, baseUrl: '/api' });
});

const ok = (data: unknown, status = 200) => new Response(JSON.stringify({ success: true, data }), { status });

describe('F3 api helpers', () => {
  it('generateWorkout posts input and returns jobId', async () => {
    let seen: Request | undefined;
    const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => {
      seen = new Request(i, init);
      return new Response(JSON.stringify({ success: true, data: { jobId: 'j1' } }), { status: 202 });
    }) as typeof fetch;
    const out = await generateWorkout(
      { goal: Goal.STRENGTH, experienceLevel: ExperienceLevel.BEGINNER, daysPerWeek: 3 },
      fetchImpl,
    );
    expect(out.jobId).toBe('j1');
    expect(seen?.method).toBe('POST');
    expect(new URL(seen!.url).pathname).toContain('/workout/generate');
  });

  it('getActiveMeal returns null when no plan', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: null }), { status: 200 })) as typeof fetch;
    expect(await getActiveMeal(fetchImpl)).toBeNull();
  });

  it('getGenerationJob fetches a workout job by id', async () => {
    const job = {
      id: 'jid',
      userId: 'u1',
      type: 'workout',
      status: 'queued',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    let seen: Request | undefined;
    const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => {
      seen = new Request(i, init);
      return ok(job);
    }) as typeof fetch;
    const out = await getGenerationJob('jid', fetchImpl);
    expect(out.id).toBe('jid');
    expect(new URL(seen!.url).pathname).toBe('/api/workout/jobs/jid');
  });

  it('generateMeal posts input and returns jobId', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: { jobId: 'm1' } }), { status: 202 })) as typeof fetch;
    const out = await generateMeal(
      {
        goal: Goal.WEIGHT_LOSS,
        gender: Gender.MALE,
        age: 30,
        heightCm: 180,
        weightKg: 80,
        activityLevel: ActivityLevel.MODERATE,
      },
      fetchImpl,
    );
    expect(out.jobId).toBe('m1');
  });

  it('getMealJob fetches a meal job by id', async () => {
    const job = {
      id: 'jid2',
      userId: 'u1',
      type: 'meal',
      status: 'processing',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const fetchImpl = (async () => ok(job)) as typeof fetch;
    const out = await getMealJob('jid2', fetchImpl);
    expect(out.status).toBe('processing');
  });

  it('analyzeInbody posts input and returns jobId', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: { jobId: 'i1' } }), { status: 202 })) as typeof fetch;
    const out = await analyzeInbody({ imageBase64: 'abc', mimeType: ImageMimeType.PNG }, fetchImpl);
    expect(out.jobId).toBe('i1');
  });

  it('getInbodyJob fetches an inbody job by id', async () => {
    const job = {
      id: 'jid3',
      userId: 'u1',
      type: 'inbody',
      status: 'done',
      resultId: 'r1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    const fetchImpl = (async () => ok(job)) as typeof fetch;
    const out = await getInbodyJob('jid3', fetchImpl);
    expect(out.resultId).toBe('r1');
  });

  it('getLatestInbody returns null when no result', async () => {
    const fetchImpl = (async () => ok(null)) as typeof fetch;
    expect(await getLatestInbody(fetchImpl)).toBeNull();
  });

  it('getStatsSummary fetches summary', async () => {
    const summary = { totalSessions: 1, totalVolume: 2, totalPrs: 3, totalExercises: 4 };
    const fetchImpl = (async () => ok(summary)) as typeof fetch;
    expect(await getStatsSummary(fetchImpl)).toEqual(summary);
  });

  it('getAwards fetches an array of awards', async () => {
    const awards = [
      { key: 'first_workout', name: { en: 'a', vi: 'a' }, description: { en: 'b', vi: 'b' }, target: 1, current: 1, earned: true },
    ];
    const fetchImpl = (async () => ok(awards)) as typeof fetch;
    const out = await getAwards(fetchImpl);
    expect(out).toHaveLength(1);
  });

  it('logWeight posts input and returns the weight log', async () => {
    const log = { id: 'w1', userId: 'u1', weightKg: 70, loggedAt: new Date('2026-01-01T00:00:00.000Z'), createdAt: new Date('2026-01-01T00:00:00.000Z') };
    let seen: Request | undefined;
    const fetchImpl = (async (i: RequestInfo, init?: RequestInit) => {
      seen = new Request(i, init);
      return ok(log);
    }) as typeof fetch;
    const out = await logWeight({ weightKg: 70 }, fetchImpl);
    expect(out.id).toBe('w1');
    expect(seen?.method).toBe('POST');
  });

  it('getWeightHistory fetches an array of weight logs', async () => {
    const logs = [{ id: 'w1', userId: 'u1', weightKg: 70, loggedAt: new Date('2026-01-01T00:00:00.000Z'), createdAt: new Date('2026-01-01T00:00:00.000Z') }];
    const fetchImpl = (async () => ok(logs)) as typeof fetch;
    const out = await getWeightHistory(fetchImpl);
    expect(out).toHaveLength(1);
  });
});
