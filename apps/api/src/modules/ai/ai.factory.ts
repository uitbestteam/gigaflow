import { AiProviderName } from '@gigaflow/shared';
import { AiEngine, type AiProvider, type AiPrompt } from './ai-provider.js';
import { GeminiProvider } from './providers/gemini.provider.js';
import { OpenAiProvider } from './providers/openai.provider.js';
import { VertexProvider } from './providers/vertex.provider.js';

class UnconfiguredAiProvider implements AiProvider {
  name = AiProviderName.GEMINI;

  // eslint-disable-next-line @typescript-eslint/require-await
  async generatePlan(_prompt: AiPrompt): Promise<unknown> {
    throw new Error('no AI provider configured');
  }
}

const VALID_PROVIDER_NAMES: readonly AiProviderName[] = Object.values(AiProviderName);

const DEFAULT_ORDER: Record<'workout' | 'meal', AiProviderName[]> = {
  workout: [AiProviderName.GEMINI, AiProviderName.OPENAI],
  meal: [AiProviderName.GEMINI],
};

export function resolveProviderOrder(kind: 'workout' | 'meal'): AiProviderName[] {
  const raw = process.env.AI_PROVIDER_ORDER;
  if (!raw || raw.trim() === '') {
    return [...DEFAULT_ORDER[kind]];
  }

  const parsed = raw
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name): name is AiProviderName => VALID_PROVIDER_NAMES.includes(name as AiProviderName));

  return parsed.length > 0 ? parsed : [...DEFAULT_ORDER[kind]];
}

function buildProvider(name: AiProviderName): AiProvider | undefined {
  switch (name) {
    case AiProviderName.GEMINI: {
      const geminiKey = process.env.GEMINI_API_KEY;
      return geminiKey ? new GeminiProvider(geminiKey, process.env.GEMINI_MODEL) : undefined;
    }
    case AiProviderName.OPENAI: {
      const openAiKey = process.env.OPENAI_API_KEY;
      return openAiKey ? new OpenAiProvider(openAiKey, process.env.OPENAI_MODEL) : undefined;
    }
    case AiProviderName.VERTEX: {
      const project = process.env.VERTEX_PROJECT_ID ?? process.env.GCP_PROJECT_ID;
      if (!project) {
        return undefined;
      }
      const location = process.env.VERTEX_LOCATION ?? 'global';
      const model = process.env.VERTEX_MODEL ?? 'gemini-2.5-flash';
      return new VertexProvider({ project, location, model });
    }
    default:
      return undefined;
  }
}

function buildEngineForOrder(order: AiProviderName[]): AiEngine {
  const providers: AiProvider[] = [];
  const seen = new Set<AiProviderName>();

  for (const name of order) {
    if (seen.has(name)) {
      continue;
    }
    const provider = buildProvider(name);
    if (provider) {
      providers.push(provider);
      seen.add(name);
    }
  }

  if (providers.length === 0) {
    providers.push(new UnconfiguredAiProvider());
  }

  return new AiEngine(providers);
}

export function buildAiEngine(): AiEngine {
  return buildEngineForOrder(resolveProviderOrder('workout'));
}

export function buildMealAiEngine(): AiEngine {
  return buildEngineForOrder(resolveProviderOrder('meal'));
}
