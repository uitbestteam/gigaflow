import type { VisionAnalyzer, VisionAnalyzeInput } from './vision.js';
import { GeminiVisionAnalyzer } from './vision.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

class UnconfiguredVisionAnalyzer implements VisionAnalyzer {
  // eslint-disable-next-line @typescript-eslint/require-await
  async analyze(_input: VisionAnalyzeInput): Promise<unknown> {
    throw new Error('no AI provider configured');
  }
}

export function buildInbodyAnalyzer(): VisionAnalyzer {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return new GeminiVisionAnalyzer(apiKey, process.env.GEMINI_MODEL ?? DEFAULT_MODEL);
  }
  return new UnconfiguredVisionAnalyzer();
}
