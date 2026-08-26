import { describe, it, expect } from 'vitest';
import { buildWorkoutPrompt } from './prompt';

const input = {
  goal: 'hypertrophy', experienceLevel: 'beginner', daysPerWeek: 3,
  catalog: [{ slug: 'bench-barbell', nameEn: 'Bench press', muscleGroup: 'chest' }],
  history: [{ slug: 'bench-barbell', lastWeightKg: 60, lastReps: 8, bestE1RM: 75 }],
};

describe('buildWorkoutPrompt', () => {
  it('embeds catalog slugs, history and constraints', () => {
    const { system, user } = buildWorkoutPrompt(input);
    expect(system.toLowerCase()).toContain('json');
    expect(user).toContain('bench-barbell');
    expect(user).toContain('hypertrophy');
    expect(user).toContain('3'); // daysPerWeek
    expect(user).toMatch(/60|75/); // history numbers present
  });
  it('handles empty history', () => {
    const { user } = buildWorkoutPrompt({ ...input, history: [] });
    expect(user).toContain('bench-barbell');
  });
});
