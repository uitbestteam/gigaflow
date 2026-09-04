import { AiProviderName } from '@gigaflow/shared';
import type { AiProvider, AiPrompt } from '../ai-provider.js';
import type { TokenProvider } from '../vertex-auth.js';
import { vertexGenerateContentUrl, defaultTokenProvider } from '../vertex-auth.js';
import { extractGeminiText } from '../gemini-parse.js';

export interface VertexProviderConfig {
  project: string;
  location: string;
  model: string;
}

export interface VertexProviderDeps {
  tokenProvider?: TokenProvider;
  fetchImpl?: typeof fetch;
}

export class VertexProvider implements AiProvider {
  name = AiProviderName.VERTEX;

  private readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: VertexProviderConfig,
    deps?: VertexProviderDeps,
  ) {
    this.tokenProvider = deps?.tokenProvider ?? defaultTokenProvider();
    this.fetchImpl = deps?.fetchImpl ?? fetch;
  }

  async generatePlan(prompt: AiPrompt): Promise<unknown> {
    const url = vertexGenerateContentUrl(this.config.project, this.config.location, this.config.model);
    const token = await this.tokenProvider.getAccessToken();
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: `${prompt.system}\n\n${prompt.user}` }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Vertex request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    return JSON.parse(extractGeminiText(json)) as unknown;
  }
}
