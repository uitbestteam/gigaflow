import type { InbodyMetrics } from '@gigaflow/shared';
import { zInbodyMetrics } from '@gigaflow/shared';
import type { VisionAnalyzer } from './vision.js';
import { buildInbodyPrompt } from './inbody-prompt.js';

export interface AnalyzeInbodyInput {
  imageBase64: string;
  mimeType: string;
}

export async function analyzeInbody(
  analyzer: VisionAnalyzer,
  input: AnalyzeInbodyInput,
): Promise<InbodyMetrics> {
  const raw = await analyzer.analyze({ ...input, prompt: buildInbodyPrompt() });
  return zInbodyMetrics.parse(raw);
}
