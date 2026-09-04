# GigaFlow — Vertex AI Provider (parallel with AI Studio) Design

**Date:** 2026-09-04
**Status:** Prepared — hold execution until the "GenAI App Builder" credit is confirmed to cover Vertex AI Gemini SKUs (verify on Billing first).
**Scope:** `apps/api` + one tiny `packages/shared` enum add + Terraform IAM. Add **Vertex AI Gemini** as an AI provider that runs **in parallel** with the existing AI Studio Gemini (`GEMINI_API_KEY`) and OpenAI — selectable/ordered by config. No behavior change unless Vertex is configured.

## 1. Goal

The app's AI generation (workout, meal, InBody vision) currently calls **AI Studio Gemini** (`generativelanguage.googleapis.com` with `GEMINI_API_KEY`) + OpenAI fallback. That path bills outside GCP and cannot consume a GCP credit. Add a **Vertex AI** provider (same Gemini models, `aiplatform.googleapis.com`, ADC auth) so the same prompts can run through GCP/Vertex — enabling GCP credits and unifying auth in Cloud Run — while keeping AI Studio + OpenAI available. Which provider(s) run, and in what order, is config-driven.

## 2. Locked decisions

- **Parallel, not a switch.** Vertex is an additional `AiProvider`; AI Studio Gemini and OpenAI stay. The engine's existing fallback chain is reused; provider **order** is config-driven (`AI_PROVIDER_ORDER`). Default order (no new env) is unchanged → zero behavior change for current deployments.
- **Identical response shape.** Vertex `:generateContent` returns the same `candidates[0].content.parts[0].text` shape as AI Studio, so the existing text-extraction + `zGeneratedPlan`/`zMealPlan` parsing is reused. Vertex accepts the same body (`contents` + `generationConfig.responseMimeType: application/json`).
- **Auth via ADC, injected for tests.** Vertex uses `Authorization: Bearer <ADC token>` (no API key). In Cloud Run the runtime SA supplies ADC automatically; locally, `gcloud auth application-default login`. A `TokenProvider` seam (`getAccessToken(): Promise<string>`) + injectable `fetchImpl` keep the provider unit-testable with **no real GCP/network** (mirrors every other injectable seam in this codebase). Default `TokenProvider` uses `google-auth-library`'s `GoogleAuth` (cloud-platform scope).
- **Endpoint host rule:** `location === 'global'` → host `https://aiplatform.googleapis.com`; else `https://{location}-aiplatform.googleapis.com`. Path `/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent`.
- **Defaults:** `VERTEX_LOCATION=global`, `VERTEX_MODEL=gemini-2.5-flash` (verified working), `VERTEX_PROJECT_ID` falls back to `GCP_PROJECT_ID`. Vertex provider is **enabled only when** `VERTEX_PROJECT_ID`/`GCP_PROJECT_ID` is set AND Vertex is requested via `AI_PROVIDER_ORDER` (or an explicit `AI_USE_VERTEX=true`).
- **Cloud Run SA needs `roles/aiplatform.user`** — add to Terraform. Tests never touch real Vertex.

## 3. Design

### 3.1 Shared
`packages/shared/src/enums/index.ts` — add `VERTEX = 'vertex'` to `AiProviderName`.

### 3.2 Vertex auth + URL helpers (`apps/api/src/modules/ai/vertex-auth.ts`, shared by text + vision)
- `export interface TokenProvider { getAccessToken(): Promise<string>; }`
- `export function defaultTokenProvider(): TokenProvider` — wraps `new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] })`; `getAccessToken()` → `auth.getAccessToken()` (throws if null). (Add `google-auth-library` as a direct `apps/api` dep; it's already transitively present via firebase-admin.)
- `export function vertexGenerateContentUrl(project: string, location: string, model: string): string` — applies the host rule above.

### 3.3 Text provider (`apps/api/src/modules/ai/providers/vertex.provider.ts`)
`class VertexProvider implements AiProvider` — `name = AiProviderName.VERTEX`. Constructor `(config: { project; location; model }, deps?: { tokenProvider?; fetchImpl? })`. `generatePlan(prompt)`: build URL; `fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${await getAccessToken()}`, 'Content-Type':'application/json' }, body: JSON.stringify({ contents:[{ role:'user', parts:[{ text:`${system}\n\n${user}` }] }], generationConfig:{ responseMimeType:'application/json' } }) })`; on `!res.ok` throw with status; extract text (reuse a shared `extractGeminiText` — factor the existing `extractText` out of `gemini.provider.ts` into a shared helper both import, DRY); `JSON.parse(text)`. Returns `unknown` (engine validates with the Zod schema).

### 3.4 Vision provider (`apps/api/src/modules/inbody/vertex-vision.ts`)
`class VertexVisionAnalyzer implements VisionAnalyzer` — same auth/url helpers; `analyze({imageBase64,mimeType,prompt})` posts `contents:[{ role:'user', parts:[{ inline_data:{ mime_type: mimeType, data: imageBase64 } }, { text: prompt }] }]` + `generationConfig.responseMimeType:'application/json'`; reuse the shared text extractor; `JSON.parse`. (Vertex Gemini vision uses `inline_data` like AI Studio.)

### 3.5 Factories (config-driven order)
- Add a small `resolveProviderOrder(): AiProviderName[]` reading `AI_PROVIDER_ORDER` (comma list, e.g. `vertex,gemini,openai`); default `[gemini, openai]` for `buildAiEngine`, `[gemini]` for `buildMealAiEngine` (unchanged). A provider is added only if configured (Gemini needs `GEMINI_API_KEY`; OpenAI needs `OPENAI_API_KEY`; Vertex needs a project id). Unknown/undisabled names are skipped.
- `buildAiEngine()` / `buildMealAiEngine()` build the ordered, configured list; if empty → the existing `UnconfiguredAiProvider`. Meal may include Vertex too (meal was Gemini-only; allow Vertex in the meal order if requested).
- `buildInbodyAnalyzer()` returns `VertexVisionAnalyzer` when Vertex is requested + configured, else the existing `GeminiVisionAnalyzer`, else unconfigured.

### 3.6 Env (`apps/api` / `.env.example`)
`VERTEX_PROJECT_ID` (default `GCP_PROJECT_ID`), `VERTEX_LOCATION` (default `global`), `VERTEX_MODEL` (default `gemini-2.5-flash`), `AI_PROVIDER_ORDER` (optional; e.g. `vertex,gemini,openai`). Document that Vertex needs ADC (Cloud Run SA `roles/aiplatform.user`, or local `gcloud auth application-default login`) — no API key.

### 3.7 Terraform
`infra/envs/dev/main.tf` (+ prod): grant the `gigaflow-api` SA `roles/aiplatform.user`; ensure `aiplatform.googleapis.com` is in the enabled-APIs list (infra/README). No secret needed (ADC, not a key).

## 4. Testing
- `vertex-auth`: `vertexGenerateContentUrl` host rule (global vs region); `defaultTokenProvider` not unit-tested against real ADC (thin) — inject a fake `TokenProvider` everywhere else.
- `VertexProvider`: fake `tokenProvider` + fake `fetchImpl` → posts Bearer token to the right URL, parses a Gemini-shaped JSON envelope, throws on non-2xx (mirror `ai-engine.test.ts` / provider tests). No real network.
- `VertexVisionAnalyzer`: fake deps → posts `inline_data` + prompt, extracts text. No real network.
- Factory: `AI_PROVIDER_ORDER=vertex,gemini` with a project id + `GEMINI_API_KEY` → engine has [Vertex, Gemini] in that order; no order env → unchanged default; Vertex omitted when no project id.
- Shared: `AiProviderName.VERTEX` exists.
- All green: `pnpm --filter @gigaflow/shared test`, `pnpm --filter @gigaflow/api test`, root `pnpm typecheck`.

## 5. Non-goals / deferred
- Real Vertex calls / credit verification (manual, on Billing — the prerequisite gate for even running this).
- Streaming, function-calling, or Vertex-specific features — parity with the current single-shot JSON generation only.
- Removing AI Studio / OpenAI (kept in parallel).
- Cloud Run env wiring beyond adding the vars + IAM (real deploy is infra-phase).

## 6. Task decomposition (for writing-plans)
1. Shared `AiProviderName.VERTEX` + `vertex-auth.ts` (TokenProvider + defaultTokenProvider + vertexGenerateContentUrl) + extract shared `extractGeminiText` from gemini.provider.ts — TDD. [Thành Duy]
2. `VertexProvider` (text) — TDD (fake token + fetch). [Thành Duy]
3. Factory order/config (`resolveProviderOrder` + Vertex in buildAiEngine/buildMealAiEngine) — TDD. [Thành Duy]
4. `VertexVisionAnalyzer` + buildInbodyAnalyzer Vertex path — TDD. [Thành Duy]
5. Env + Terraform (`roles/aiplatform.user`, aiplatform API) + README/.env.example docs. [Bảo Hân]

**Prereq to execute:** confirm on Billing that the credit offsets Vertex AI Gemini SKUs. If it only covers Agent Builder/Discovery Engine, this task delivers no credit benefit (though it still unifies auth in Cloud Run — a valid reason to ship anyway).
