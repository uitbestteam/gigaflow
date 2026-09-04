import { describe, it, expect } from 'vitest';
import { vertexGenerateContentUrl } from './vertex-auth.js';

describe('vertexGenerateContentUrl', () => {
  it('uses the unprefixed host for global', () => {
    expect(vertexGenerateContentUrl('p', 'global', 'gemini-2.5-flash')).toBe(
      'https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-2.5-flash:generateContent',
    );
  });
  it('uses the region-prefixed host otherwise', () => {
    expect(vertexGenerateContentUrl('p', 'us-central1', 'gemini-2.5-flash')).toBe(
      'https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent',
    );
  });
});
