import { describe, it, expect } from 'vitest';
import { zInbodyMetrics, zAnalyzeInbodyInput, ImageMimeType } from '../index.js';

describe('inbody schemas', () => {
  it('accepts metrics with only weight', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: 72 }).success).toBe(true);
  });
  it('accepts full metrics', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: 72, bmi: 22.5, bodyFatPercent: 18, skeletalMuscleMassKg: 33, bodyFatMassKg: 13, visceralFatLevel: 7 }).success).toBe(true);
  });
  it('rejects a negative weight', () => {
    expect(zInbodyMetrics.safeParse({ weightKg: -1 }).success).toBe(false);
  });
  it('accepts a valid analyze input', () => {
    expect(zAnalyzeInbodyInput.safeParse({ imageBase64: 'abc', mimeType: ImageMimeType.PNG }).success).toBe(true);
  });
  it('rejects an unsupported mime type', () => {
    expect(zAnalyzeInbodyInput.safeParse({ imageBase64: 'abc', mimeType: 'image/gif' }).success).toBe(false);
  });
  it('rejects an over-limit imageBase64 string', () => {
    const oversized = 'a'.repeat(10_000_001);
    expect(zAnalyzeInbodyInput.safeParse({ imageBase64: oversized, mimeType: ImageMimeType.PNG }).success).toBe(false);
  });
});
