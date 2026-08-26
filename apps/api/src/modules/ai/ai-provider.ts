import type { GeneratedPlan, AiProviderName } from '@gigaflow/shared';
import { zGeneratedPlan } from '@gigaflow/shared';

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

  async generateWorkoutPlan(prompt: AiPrompt): Promise<GeneratedPlan> {
    for (const provider of this.providers) {
      try {
        const raw = await provider.generatePlan(prompt);
        return zGeneratedPlan.parse(raw);
      } catch (err) {
        console.warn(`[AiEngine] provider "${provider.name}" failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    throw new Error('All AI providers failed');
  }
}
