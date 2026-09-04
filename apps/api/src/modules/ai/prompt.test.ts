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
    // Schema field names must be present to ensure correct model instruction
    expect(system).toContain('templates');
    expect(system).toContain('exerciseSlug');
    expect(system).toContain('colorTag');
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

  it('omits optional intake directives when the fields are absent', () => {
    const { user } = buildWorkoutPrompt(input);
    expect(user).not.toContain('Additional Requirements');
    expect(user).not.toContain('Injuries');
    expect(user).not.toContain('Emphasis');
    expect(user).not.toContain('Session length');
  });

  it('embeds injury, equipment, session and emphasis directives when provided', () => {
    const { user } = buildWorkoutPrompt({
      ...input,
      availableEquipment: ['barbell', 'dumbbell'],
      injuries: ['knee', 'lower_back'],
      sessionMinutes: 45,
      emphasis: ['chest', 'arms'],
    });
    expect(user).toContain('Additional Requirements');
    // equipment
    expect(user).toContain('barbell');
    expect(user).toContain('dumbbell');
    // injuries
    expect(user).toContain('knee');
    expect(user).toContain('lower_back');
    expect(user).toContain('AVOID');
    // session length
    expect(user).toContain('45');
    // emphasis
    expect(user).toContain('extra sets/volume');
    expect(user).toContain('chest');
    expect(user).toContain('arms');
  });
});
