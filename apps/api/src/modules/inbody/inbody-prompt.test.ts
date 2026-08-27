import { describe, it, expect } from 'vitest';
import { buildInbodyPrompt } from './inbody-prompt.js';

describe('buildInbodyPrompt', () => {
  it('mentions weightKg, JSON and InBody', () => {
    const prompt = buildInbodyPrompt();
    expect(prompt).toContain('weightKg');
    expect(prompt.toUpperCase()).toContain('JSON');
    expect(prompt).toContain('InBody');
  });
});
