import { AiProviderName } from '@gigaflow/shared';
import type { AiProvider, AiPrompt } from '../ai-provider.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractText(json: unknown): string {
  if (!isRecord(json)) throw new Error('Gemini: unexpected response shape');
  const candidates = json.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) {
    throw new Error('Gemini: missing candidates in response');
  }
  const first = candidates[0];
  if (!isRecord(first) || !isRecord(first.content)) {
    throw new Error('Gemini: missing content in candidate');
  }
  const parts = first.content.parts;
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error('Gemini: missing parts in candidate content');
  }
  const part = parts[0];
  if (!isRecord(part) || typeof part.text !== 'string') {
    throw new Error('Gemini: missing text in candidate part');
  }
  return part.text;
}

export class GeminiProvider implements AiProvider {
  name = AiProviderName.GEMINI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async generatePlan(prompt: AiPrompt): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${prompt.system}\n\n${prompt.user}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    const text = extractText(json);
    return JSON.parse(text) as unknown;
  }
}
