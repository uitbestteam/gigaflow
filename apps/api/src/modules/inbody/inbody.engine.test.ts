import { describe, it, expect } from 'vitest';
import type { VisionAnalyzer } from './vision.js';
import { analyzeInbody } from './inbody.engine.js';

const fake = (impl: () => Promise<unknown>): VisionAnalyzer => ({ analyze: impl });

describe('analyzeInbody', () => {
  it('returns parsed metrics from a valid analyzer response', async () => {
    const analyzer = fake(async () => ({ weightKg: 72, bodyFatPercent: 18 }));
    const metrics = await analyzeInbody(analyzer, {
      imageBase64: 'abc',
      mimeType: 'image/png',
    });
    expect(metrics).toEqual({ weightKg: 72, bodyFatPercent: 18 });
  });

  it('rejects when the analyzer response is schema-invalid', async () => {
    const analyzer = fake(async () => ({}));
    await expect(
      analyzeInbody(analyzer, { imageBase64: 'abc', mimeType: 'image/png' }),
    ).rejects.toThrow();
  });
});
