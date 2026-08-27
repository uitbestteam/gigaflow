import { AiProviderName } from '@gigaflow/shared';
import { AiEngine, type AiProvider, type AiPrompt } from './ai-provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';

class UnconfiguredAiProvider implements AiProvider {
  name = AiProviderName.GEMINI;

  // eslint-disable-next-line @typescript-eslint/require-await
  async generatePlan(_prompt: AiPrompt): Promise<unknown> {
    throw new Error('no AI provider configured');
  }
}

export function buildAiEngine(): AiEngine {
  const providers: AiProvider[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    providers.push(new GeminiProvider(geminiKey, process.env.GEMINI_MODEL));
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    providers.push(new OpenAiProvider(openAiKey, process.env.OPENAI_MODEL));
  }

  if (providers.length === 0) {
    providers.push(new UnconfiguredAiProvider());
  }

  return new AiEngine(providers);
}

export function buildMealAiEngine(): AiEngine {
  const providers: AiProvider[] = [];

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    providers.push(new GeminiProvider(geminiKey, process.env.GEMINI_MODEL));
  }

  if (providers.length === 0) {
    providers.push(new UnconfiguredAiProvider());
  }

  return new AiEngine(providers);
}
