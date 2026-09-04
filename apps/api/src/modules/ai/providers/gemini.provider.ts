import { AiProviderName } from '@gigaflow/shared';
import type { AiProvider, AiPrompt } from '../ai-provider.js';
import { extractGeminiText } from '../gemini-parse.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

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
    const text = extractGeminiText(json);
    return JSON.parse(text) as unknown;
  }
}
