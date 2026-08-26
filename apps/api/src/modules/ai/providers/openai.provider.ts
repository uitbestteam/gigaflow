import { AiProviderName } from '@gigaflow/shared';
import type { AiProvider, AiPrompt } from '../ai-provider.js';

const DEFAULT_MODEL = 'gpt-4o-mini';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractContent(json: unknown): string {
  if (!isRecord(json)) throw new Error('OpenAI: unexpected response shape');
  const choices = json.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('OpenAI: missing choices in response');
  }
  const first = choices[0];
  if (!isRecord(first) || !isRecord(first.message)) {
    throw new Error('OpenAI: missing message in choice');
  }
  const content = first.message.content;
  if (typeof content !== 'string') {
    throw new Error('OpenAI: missing content in message');
  }
  return content;
}

export class OpenAiProvider implements AiProvider {
  name = AiProviderName.OPENAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async generatePlan(prompt: AiPrompt): Promise<unknown> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user },
        ],
        response_format: { type: 'json_object' },
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    const content = extractContent(json);
    return JSON.parse(content) as unknown;
  }
}
