import { describe, it, expect } from 'vitest';
import { VertexVisionAnalyzer } from './vertex-vision.js';

describe('VertexVisionAnalyzer', () => {
  it('posts inline_data + text parts with a bearer token and parses the JSON candidate', async () => {
    let seen: { url: string; init?: RequestInit } | undefined;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      seen = { url: String(url), init };
      return new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"weightKg":70}' }] } }] }),
        { status: 200 },
      );
    }) as unknown as typeof fetch;

    const analyzer = new VertexVisionAnalyzer(
      { project: 'proj', location: 'global', model: 'gemini-2.5-flash' },
      { tokenProvider: { getAccessToken: async () => 'tok123' }, fetchImpl },
    );

    const out = await analyzer.analyze({ imageBase64: 'b64', mimeType: 'image/png', prompt: 'p' });

    expect(out).toEqual({ weightKg: 70 });
    expect(seen?.url).toContain(
      '/projects/proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent',
    );
    expect((seen?.init?.headers as Record<string, string>).Authorization).toBe('Bearer tok123');

    const body = JSON.parse(String(seen?.init?.body)) as {
      contents: { role: string; parts: unknown[] }[];
    };
    expect(body.contents[0]?.role).toBe('user');
    expect(body.contents[0]?.parts).toContainEqual({
      inline_data: { mime_type: 'image/png', data: 'b64' },
    });
    expect(body.contents[0]?.parts).toContainEqual({ text: 'p' });
  });

  it('throws on a non-2xx response', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
    const analyzer = new VertexVisionAnalyzer(
      { project: 'proj', location: 'global', model: 'm' },
      { tokenProvider: { getAccessToken: async () => 't' }, fetchImpl },
    );

    await expect(
      analyzer.analyze({ imageBase64: 'b64', mimeType: 'image/png', prompt: 'p' }),
    ).rejects.toThrow(/403/);
  });
});
