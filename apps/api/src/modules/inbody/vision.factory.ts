import { AiProviderName } from '@gigaflow/shared';
import type { VisionAnalyzer, VisionAnalyzeInput } from './vision.js';
import { GeminiVisionAnalyzer } from './vision.js';
import { VertexVisionAnalyzer } from './vertex-vision.js';
import { resolveProviderOrder } from '../ai/ai.factory.js';

const DEFAULT_MODEL = 'gemini-2.0-flash';

class UnconfiguredVisionAnalyzer implements VisionAnalyzer {
  // eslint-disable-next-line @typescript-eslint/require-await
  async analyze(_input: VisionAnalyzeInput): Promise<unknown> {
    throw new Error('no AI provider configured');
  }
}

function vertexIsPreferred(): boolean {
  const order = resolveProviderOrder('workout');
  const vertexIndex = order.indexOf(AiProviderName.VERTEX);
  if (vertexIndex === -1) {
    return false;
  }
  const geminiIndex = order.indexOf(AiProviderName.GEMINI);
  return geminiIndex === -1 || vertexIndex < geminiIndex;
}

export function buildInbodyAnalyzer(): VisionAnalyzer {
  if (vertexIsPreferred()) {
    const project = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
    if (project) {
      const location = process.env.VERTEX_LOCATION ?? 'global';
      const model = process.env.VERTEX_MODEL ?? 'gemini-2.5-flash';
      return new VertexVisionAnalyzer({ project, location, model });
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    return new GeminiVisionAnalyzer(apiKey, process.env.GEMINI_MODEL ?? DEFAULT_MODEL);
  }
  return new UnconfiguredVisionAnalyzer();
}
