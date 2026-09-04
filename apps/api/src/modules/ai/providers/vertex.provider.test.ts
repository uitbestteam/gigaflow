import { describe, it, expect } from 'vitest';
import { VertexProvider } from './vertex.provider.js';

describe('VertexProvider', () => {
  it('posts a bearer token to the vertex url and parses the JSON candidate', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"P","templates":[]}' }] } }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;
    const p = new VertexProvider(
      { project: 'proj', location: 'global', model: 'gemini-2.5-flash' },
      { tokenProvider: { getAccessToken: async () => 'tok123' }, fetchImpl },
    );
    const out = await p.generatePlan({ system: 's', user: 'u' });
    expect(out).toEqual({ name: 'P', templates: [] });
    expect(seen?.url).toContain('/projects/proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent');
    expect((seen?.init?.headers as Record<string, string>).Authorization).toBe('Bearer tok123');
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
    const p = new VertexProvider(
      { project: 'proj', location: 'global', model: 'm' },
      { tokenProvider: { getAccessToken: async () => 't' }, fetchImpl },
    );
    await expect(p.generatePlan({ system: 's', user: 'u' })).rejects.toThrow(/403/);
  });
});
