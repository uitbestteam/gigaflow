import { describe, it, expect } from 'vitest';
import { buildMealPrompt } from './meal-prompt.js';

const input = {
  targetCalories: 2200,
  proteinG: 150,
  carbsG: 220,
  fatG: 70,
  goal: 'muscle_gain',
};

describe('buildMealPrompt', () => {
  it('embeds schema field names and JSON instruction in the system prompt', () => {
    const { system } = buildMealPrompt(input);
    expect(system).toContain('days');
    expect(system).toContain('mealType');
    expect(system).toContain('ingredients');
    expect(system.toLowerCase()).toContain('json');
  });

  it('embeds target calories, macros and goal in the user prompt', () => {
    const { user } = buildMealPrompt(input);
    expect(user).toContain('2200');
    expect(user).toContain('150');
    expect(user).toContain('220');
    expect(user).toContain('70');
    expect(user).toContain('muscle_gain');
  });
});
