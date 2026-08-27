import { describe, it, expect } from 'vitest';
import { AiProviderName } from '@gigaflow/shared';
import { AiEngine, type AiProvider } from './ai-provider.js';

const validRaw = { name: 'P', templates: [{ name: { en: 'Push', vi: 'Đẩy' }, colorTag: 'push', slots: [{ exerciseSlug: 'bench-barbell', setsTarget: 4, repRangeMin: 6, repRangeMax: 10 }] }] };

const validMealRaw = {
  name: 'M',
  days: [
    {
      dayIndex: 1,
      meals: [
        {
          name: { en: 'Oatmeal', vi: 'Yến mạch' },
          mealType: 'breakfast',
          calories: 400,
          proteinG: 20,
          carbsG: 60,
          fatG: 10,
          ingredients: ['oats', 'milk'],
        },
      ],
      totalCalories: 400,
      totalProteinG: 20,
      totalCarbsG: 60,
      totalFatG: 10,
    },
  ],
};

const fake = (name: AiProviderName, impl: () => Promise<unknown>): AiProvider => ({ name, generatePlan: impl });

describe('AiEngine', () => {
  it('returns the first provider result when valid', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => validRaw)]);
    const plan = await engine.generateWorkoutPlan({ system: 's', user: 'u' });
    expect(plan.templates[0].slots[0].exerciseSlug).toBe('bench-barbell');
  });
  it('falls back to the next provider when the first throws', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => { throw new Error('quota'); }),
      fake(AiProviderName.OPENAI, async () => validRaw),
    ]);
    const plan = await engine.generateWorkoutPlan({ system: 's', user: 'u' });
    expect(plan.name).toBe('P');
  });
  it('falls back when the first returns schema-invalid output', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => ({ name: 'x', templates: [] })),
      fake(AiProviderName.OPENAI, async () => validRaw),
    ]);
    expect((await engine.generateWorkoutPlan({ system: 's', user: 'u' })).templates.length).toBe(1);
  });
  it('throws when all providers fail', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => { throw new Error('x'); })]);
    await expect(engine.generateWorkoutPlan({ system: 's', user: 'u' })).rejects.toThrow(/All AI providers failed/);
  });

  it('generateMealPlan returns the first provider result when valid', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => validMealRaw)]);
    const plan = await engine.generateMealPlan({ system: 's', user: 'u' });
    expect(plan.days[0].meals[0].mealType).toBe('breakfast');
  });

  it('generateMealPlan falls back to the next provider when the first throws', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => { throw new Error('quota'); }),
      fake(AiProviderName.OPENAI, async () => validMealRaw),
    ]);
    const plan = await engine.generateMealPlan({ system: 's', user: 'u' });
    expect(plan.name).toBe('M');
  });

  it('generateMealPlan falls back when the first returns schema-invalid output', async () => {
    const engine = new AiEngine([
      fake(AiProviderName.GEMINI, async () => ({ name: 'x', days: [] })),
      fake(AiProviderName.OPENAI, async () => validMealRaw),
    ]);
    expect((await engine.generateMealPlan({ system: 's', user: 'u' })).days.length).toBe(1);
  });

  it('generateMealPlan throws when all providers fail', async () => {
    const engine = new AiEngine([fake(AiProviderName.GEMINI, async () => { throw new Error('x'); })]);
    await expect(engine.generateMealPlan({ system: 's', user: 'u' })).rejects.toThrow(/All AI providers failed/);
  });
});
