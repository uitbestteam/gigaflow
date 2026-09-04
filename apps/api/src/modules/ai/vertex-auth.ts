import { GoogleAuth } from 'google-auth-library';

export interface TokenProvider {
  getAccessToken(): Promise<string>;
}

export function vertexGenerateContentUrl(project: string, location: string, model: string): string {
  const host =
    location === 'global' ? 'https://aiplatform.googleapis.com' : `https://${location}-aiplatform.googleapis.com`;
  return `${host}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
}

export function defaultTokenProvider(): TokenProvider {
  return {
    getAccessToken: async () => {
      const t = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getAccessToken();
      if (!t) throw new Error('Vertex: no ADC access token');
      return t;
    },
  };
}
