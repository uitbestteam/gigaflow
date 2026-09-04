import { describe, it, expect, afterEach } from 'vitest';
import { buildInbodyAnalyzer } from './vision.factory.js';
import { GeminiVisionAnalyzer } from './vision.js';
import { VertexVisionAnalyzer } from './vertex-vision.js';

const ENV_KEYS = [
  'AI_PROVIDER_ORDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'VERTEX_PROJECT_ID',
  'GCP_PROJECT_ID',
  'VERTEX_LOCATION',
  'VERTEX_MODEL',
] as const;

const originalEnv: Record<string, string | undefined> = {};
for (const key of ENV_KEYS) {
  originalEnv[key] = process.env[key];
}

function resetEnv(): void {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('buildInbodyAnalyzer', () => {
  afterEach(() => {
    resetEnv();
  });

  it('returns a VertexVisionAnalyzer when Vertex is preferred and a project id is configured', () => {
    process.env.AI_PROVIDER_ORDER = 'vertex,gemini';
    process.env.GCP_PROJECT_ID = 'p';
    process.env.GEMINI_API_KEY = 'k';

    const analyzer = buildInbodyAnalyzer();
    expect(analyzer).toBeInstanceOf(VertexVisionAnalyzer);
  });

  it('returns a GeminiVisionAnalyzer by default when AI_PROVIDER_ORDER is unset', () => {
    delete process.env.AI_PROVIDER_ORDER;
    process.env.GEMINI_API_KEY = 'k';

    const analyzer = buildInbodyAnalyzer();
    expect(analyzer).toBeInstanceOf(GeminiVisionAnalyzer);
  });

  it('skips Vertex when no project id is configured even if listed first', () => {
    process.env.AI_PROVIDER_ORDER = 'vertex,gemini';
    delete process.env.VERTEX_PROJECT_ID;
    delete process.env.GCP_PROJECT_ID;
    process.env.GEMINI_API_KEY = 'k';

    const analyzer = buildInbodyAnalyzer();
    expect(analyzer).toBeInstanceOf(GeminiVisionAnalyzer);
  });
});
