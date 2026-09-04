import { describe, it, expect, afterEach } from 'vitest';
import { AiProviderName } from '@gigaflow/shared';
import { resolveProviderOrder, buildAiEngine, buildMealAiEngine } from './ai.factory.js';

const ENV_KEYS = [
  'AI_PROVIDER_ORDER',
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
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

describe('resolveProviderOrder', () => {
  afterEach(() => {
    resetEnv();
  });

  it('defaults to [gemini, openai] for workout when AI_PROVIDER_ORDER is unset', () => {
    delete process.env.AI_PROVIDER_ORDER;
    expect(resolveProviderOrder('workout')).toEqual([AiProviderName.GEMINI, AiProviderName.OPENAI]);
  });

  it('defaults to [gemini] for meal when AI_PROVIDER_ORDER is unset', () => {
    delete process.env.AI_PROVIDER_ORDER;
    expect(resolveProviderOrder('meal')).toEqual([AiProviderName.GEMINI]);
  });

  it('parses AI_PROVIDER_ORDER and keeps only valid provider names', () => {
    process.env.AI_PROVIDER_ORDER = 'vertex, gemini , bogus,OpenAI';
    expect(resolveProviderOrder('workout')).toEqual([
      AiProviderName.VERTEX,
      AiProviderName.GEMINI,
      AiProviderName.OPENAI,
    ]);
  });

  it('falls back to defaults when AI_PROVIDER_ORDER is empty string', () => {
    process.env.AI_PROVIDER_ORDER = '';
    expect(resolveProviderOrder('workout')).toEqual([AiProviderName.GEMINI, AiProviderName.OPENAI]);
  });
});

describe('buildAiEngine', () => {
  afterEach(() => {
    resetEnv();
  });

  it('prefers Vertex then Gemini when AI_PROVIDER_ORDER=vertex,gemini and both are configured', () => {
    process.env.AI_PROVIDER_ORDER = 'vertex,gemini';
    process.env.GCP_PROJECT_ID = 'p';
    process.env.GEMINI_API_KEY = 'k';
    delete process.env.OPENAI_API_KEY;

    const engine = buildAiEngine();
    expect(engine.providerNames).toEqual([AiProviderName.VERTEX, AiProviderName.GEMINI]);
  });

  it('keeps unchanged default order [gemini, openai] when AI_PROVIDER_ORDER is unset', () => {
    delete process.env.AI_PROVIDER_ORDER;
    process.env.GEMINI_API_KEY = 'k';
    process.env.OPENAI_API_KEY = 'o';

    const engine = buildAiEngine();
    expect(engine.providerNames).toEqual([AiProviderName.GEMINI, AiProviderName.OPENAI]);
  });

  it('skips Vertex when no project id is configured even if listed first', () => {
    process.env.AI_PROVIDER_ORDER = 'vertex,gemini';
    delete process.env.VERTEX_PROJECT_ID;
    delete process.env.GCP_PROJECT_ID;
    process.env.GEMINI_API_KEY = 'k';

    const engine = buildAiEngine();
    expect(engine.providerNames).toEqual([AiProviderName.GEMINI]);
  });

  it('falls back to UnconfiguredAiProvider when nothing is configured', () => {
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.GEMINI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const engine = buildAiEngine();
    expect(engine.providerNames).toEqual([AiProviderName.GEMINI]);
  });
});

describe('buildMealAiEngine', () => {
  afterEach(() => {
    resetEnv();
  });

  it('defaults to [gemini] when AI_PROVIDER_ORDER is unset', () => {
    delete process.env.AI_PROVIDER_ORDER;
    process.env.GEMINI_API_KEY = 'k';

    const engine = buildMealAiEngine();
    expect(engine.providerNames).toEqual([AiProviderName.GEMINI]);
  });
});
