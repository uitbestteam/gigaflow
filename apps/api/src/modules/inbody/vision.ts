import { extractGeminiText } from '../ai/gemini-parse.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

export interface VisionAnalyzeInput {
  imageBase64: string;
  mimeType: string;
  prompt: string;
}

export interface VisionAnalyzer {
  analyze(input: VisionAnalyzeInput): Promise<unknown>;
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
    const text = extractGeminiText(json);
    return JSON.parse(text) as unknown;
  }
}
