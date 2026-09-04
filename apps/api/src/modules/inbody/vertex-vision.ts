import type { TokenProvider } from '../ai/vertex-auth.js';
import { vertexGenerateContentUrl, defaultTokenProvider } from '../ai/vertex-auth.js';
import { extractGeminiText } from '../ai/gemini-parse.js';
import type { VisionAnalyzer, VisionAnalyzeInput } from './vision.js';

export interface VertexVisionAnalyzerConfig {
  project: string;
  location: string;
  model: string;
}

export interface VertexVisionAnalyzerDeps {
  tokenProvider?: TokenProvider;
  fetchImpl?: typeof fetch;
}

export class VertexVisionAnalyzer implements VisionAnalyzer {
  private readonly tokenProvider: TokenProvider;
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: VertexVisionAnalyzerConfig,
    deps?: VertexVisionAnalyzerDeps,
  ) {
    this.tokenProvider = deps?.tokenProvider ?? defaultTokenProvider();
    this.fetchImpl = deps?.fetchImpl ?? fetch;
  }

  async analyze(input: VisionAnalyzeInput): Promise<unknown> {
    const url = vertexGenerateContentUrl(this.config.project, this.config.location, this.config.model);
    const token = await this.tokenProvider.getAccessToken();
    const res = await this.fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { inline_data: { mime_type: input.mimeType, data: input.imageBase64 } },
              { text: input.prompt },
            ],
          },
        ],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    if (!res.ok) {
      throw new Error(`Vertex vision request failed: ${res.status} ${res.statusText}`);
    }
    const json: unknown = await res.json();
    return JSON.parse(extractGeminiText(json)) as unknown;
  }
}
