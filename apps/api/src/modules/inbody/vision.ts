const DEFAULT_MODEL = 'gemini-2.0-flash';

export interface VisionAnalyzeInput {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

export interface VisionAnalyzer {
  analyze(input: VisionAnalyzeInput): Promise<unknown>;
}

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

export class GeminiVisionAnalyzer implements VisionAnalyzer {
  constructor(
    private readonly apiKey: string,
    private readonly model: string = DEFAULT_MODEL,
  ) {}

  async analyze(input: VisionAnalyzeInput): Promise<unknown> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
              { text: input.prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Gemini vision request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    const text = extractText(json);
    return JSON.parse(text) as unknown;
  }
}
