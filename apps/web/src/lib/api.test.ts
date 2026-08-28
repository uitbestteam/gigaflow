import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { apiFetch, ApiError, configureApi } from './api';

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data }), { status: 200 });

beforeEach(() => {
  configureApi({ getToken: () => 'tok', onUnauthorized: async () => {}, baseUrl: '/api' });
});

describe('apiFetch', () => {
  it('attaches bearer and parses envelope + schema', async () => {
    let seen: Request | undefined;
    const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => {
      seen = new Request(input, init);
      return ok({ n: 5 });
    }) as typeof fetch;

    const out = await apiFetch('/x', { schema: z.object({ n: z.number() }), fetchImpl });

    expect(out.n).toBe(5);
    expect(seen?.headers.get('authorization')).toBe('Bearer tok');
    expect(seen?.headers.get('content-type')).toBe('application/json');
    expect(seen?.url.endsWith('/api/x')).toBe(true);
  });

  it('throws ApiError on success:false', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: false, message: 'nope' }), { status: 400 })) as typeof fetch;

    await expect(apiFetch('/x', { fetchImpl })).rejects.toMatchObject({ status: 400, message: 'nope' });
    await expect(apiFetch('/x', { fetchImpl })).rejects.toBeInstanceOf(ApiError);
  });

  it('throws ApiError when res.ok is false even if success is true', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({ success: true, data: null, message: 'server error' }), { status: 500 })) as typeof fetch;

    await expect(apiFetch('/x', { fetchImpl })).rejects.toMatchObject({ status: 500 });
  });

  it('returns json.data as-is when no schema is given', async () => {
    const fetchImpl = (async () => ok({ foo: 'bar' })) as typeof fetch;

    const out = await apiFetch<{ foo: string }>('/x', { fetchImpl });

    expect(out).toEqual({ foo: 'bar' });
  });

  it('sends method and JSON body when provided', async () => {
    let seen: Request | undefined;
    let seenBody: string | undefined;
    const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => {
      seen = new Request(input, init);
      seenBody = init?.body as string;
      return ok({ ok: true });
    }) as typeof fetch;

    await apiFetch('/x', { method: 'POST', body: { a: 1 }, fetchImpl });

    expect(seen?.method).toBe('POST');
    expect(seenBody).toBe(JSON.stringify({ a: 1 }));
  });

  it('omits the Authorization header when there is no token', async () => {
    configureApi({ getToken: () => undefined, onUnauthorized: async () => {}, baseUrl: '/api' });
    let seen: Request | undefined;
    const fetchImpl = (async (input: RequestInfo, init?: RequestInit) => {
      seen = new Request(input, init);
      return ok({ ok: true });
    }) as typeof fetch;

    await apiFetch('/x', { fetchImpl });

    expect(seen?.headers.has('authorization')).toBe(false);
  });

  it('on 401, calls onUnauthorized once then retries the request once', async () => {
    const onUnauthorized = vi.fn(async () => {});
    configureApi({ getToken: () => 'tok', onUnauthorized, baseUrl: '/api' });

    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ success: false, message: 'unauthorized' }), { status: 401 });
      }
      return ok({ n: 1 });
    }) as typeof fetch;

    const out = await apiFetch<{ n: number }>('/x', { fetchImpl });

    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(calls).toBe(2);
    expect(out.n).toBe(1);
  });

  it('revives ISO date strings so z.date() schema fields parse correctly', async () => {
    const createdAt = new Date('2026-01-15T10:30:00.000Z');
    const fetchImpl = (async () => ok({ createdAt })) as typeof fetch;

    const out = await apiFetch('/x', { schema: z.object({ createdAt: z.date() }), fetchImpl });

    expect(out.createdAt).toBeInstanceOf(Date);
    expect(out.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('on repeated 401s, calls onUnauthorized once and throws ApiError after the single retry', async () => {
    const onUnauthorized = vi.fn(async () => {});
    configureApi({ getToken: () => 'tok', onUnauthorized, baseUrl: '/api' });

    const fetchImpl = (async () => new Response(JSON.stringify({ success: false, message: 'unauthorized' }), { status: 401 })) as typeof fetch;

    await expect(apiFetch('/x', { fetchImpl })).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});
