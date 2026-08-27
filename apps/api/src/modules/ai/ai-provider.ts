import type { GeneratedPlan, AiProviderName, MealPlan } from '@gigaflow/shared';
import { zGeneratedPlan, zMealPlan } from '@gigaflow/shared';
import type { z } from 'zod';

export interface AiPrompt {
  system: string;
  user: string;
}

export interface AiProvider {
  name: AiProviderName;
  generatePlan(prompt: AiPrompt): Promise<unknown>;
}

export class AiEngine {
  constructor(private readonly providers: AiProvider[]) {}

  private async generate<T>(prompt: AiPrompt, schema: z.ZodType<T>): Promise<T> {
    for (const provider of this.providers) {
      try {
        const raw = await provider.generatePlan(prompt);
        return schema.parse(raw);
      } catch (err) {
        console.warn(`[AiEngine] provider "${provider.name}" failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error('All AI providers failed');
  }

  async generateWorkoutPlan(prompt: AiPrompt): Promise<GeneratedPlan> {
    return this.generate(prompt, zGeneratedPlan);
  }

  async generateMealPlan(prompt: AiPrompt): Promise<MealPlan> {
    return this.generate(prompt, zMealPlan);
  }
}
