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

  it('defaults to omnivore and omits allergy/cuisine/mealsPerDay directives when absent', () => {
    const { user } = buildMealPrompt(input);
    expect(user).toContain('omnivore');
    expect(user).not.toContain('STRICTLY exclude');
    expect(user).not.toContain('Model meals on');
    expect(user).not.toContain('Meals per day');
    expect(user).not.toContain('Also avoid');
  });

  it('embeds diet, allergy, cuisine, avoid and mealsPerDay directives when provided', () => {
    const { user } = buildMealPrompt({
      ...input,
      dietaryPattern: 'vegan',
      allergies: ['peanuts', 'shellfish'],
      cuisineCountry: 'vietnam',
      avoidFoods: 'cilantro',
      mealsPerDay: 5,
    });
    // dietary pattern enforced with its rule
    expect(user).toContain('vegan');
    expect(user).toContain('no animal products');
    // allergies
    expect(user).toContain('STRICTLY exclude');
    expect(user).toContain('peanuts');
    expect(user).toContain('shellfish');
    // cuisine (country preferred)
    expect(user).toContain('Model meals on vietnam');
    // avoid foods
    expect(user).toContain('cilantro');
    // meals per day
    expect(user).toContain('exactly 5 meals');
  });

  it('falls back to cuisineRegion when no country is given', () => {
    const { user } = buildMealPrompt({ ...input, cuisineRegion: 'east_asian' });
    expect(user).toContain('Model meals on east_asian');
  });
});
