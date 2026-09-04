function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function extractGeminiText(json: unknown): string {
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
