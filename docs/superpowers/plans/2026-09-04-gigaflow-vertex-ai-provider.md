# GigaFlow — Vertex AI Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. **Do NOT use git worktrees** — plain branch `ai-vertex-provider` (already created).
>
> **HOLD:** Do not execute until the user confirms the "GenAI App Builder" credit covers Vertex AI Gemini SKUs (verify on Billing). This plan is prepared and ready.

**Goal:** Add a **Vertex AI Gemini** provider that runs in parallel with the existing AI Studio Gemini + OpenAI (config-ordered), for workout, meal, and InBody-vision generation — enabling GCP credits + unified ADC auth in Cloud Run, with zero behavior change when Vertex is not configured.

**Architecture:** `apps/api` reuses its `AiProvider`/`AiEngine` chain and `VisionAnalyzer`; add a `VertexProvider` (text) and `VertexVisionAnalyzer` (image) that call `aiplatform.googleapis.com :generateContent` with an ADC Bearer token (injectable `TokenProvider` + `fetchImpl` for tests). Factories pick provider order from `AI_PROVIDER_ORDER`. One tiny shared enum add; Terraform grants the runtime SA `roles/aiplatform.user`.

**Tech Stack:** Hono/Node api; `google-auth-library` (ADC); Zod; Vitest.

**Spec:** `docs/superpowers/specs/2026-09-04-gigaflow-vertex-ai-provider-design.md`

## Global Constraints

- TypeScript strict, NO `any`, `noUncheckedIndexedAccess`; `.js` ESM import extensions in api/shared.
- Reuse the existing `AiProvider`/`AiEngine` (`apps/api/src/modules/ai/ai-provider.ts`) and `VisionAnalyzer` (`apps/api/src/modules/inbody/vision.ts`) contracts — do not fork them.
- No real GCP/network in tests: inject a fake `TokenProvider` + `fetchImpl` everywhere (mirror the existing provider tests + injectable-seam pattern). `defaultTokenProvider` (real `google-auth-library`) is thin and NOT unit-tested.
- Default behavior unchanged when Vertex is unconfigured / `AI_PROVIDER_ORDER` unset. Response shape is identical to AI Studio Gemini (`candidates[0].content.parts[0].text` → `JSON.parse`).
- Each task green: `pnpm --filter @gigaflow/api test` + root `pnpm typecheck`; Task 1 also `pnpm --filter @gigaflow/shared test`.
- Conventional Commits. Author = assignee: Thành Duy → `Duong Thanh Duy <duongduyy1512@gmail.com>`; Bảo Hân → `Đặng Bảo Hân <030537210074@st.buh.edu.vn>`.

## File Structure
`packages/shared/src/enums/index.ts`; `apps/api/src/modules/ai/{vertex-auth.ts,providers/vertex.provider.ts,ai.factory.ts,providers/gemini.provider.ts}`; `apps/api/src/modules/inbody/{vertex-vision.ts,vision.factory.ts,vision.ts}`; `.env.example`; `infra/envs/{dev,prod}/main.tf`; `infra/README.md`; README.

---

### Task 1: Shared `VERTEX` enum + vertex-auth helpers + shared Gemini text extractor — TDD — [Thành Duy]

**Files:** modify `packages/shared/src/enums/index.ts`; create `apps/api/src/modules/ai/vertex-auth.ts`, `apps/api/src/modules/ai/vertex-auth.test.ts`; modify `apps/api/src/modules/ai/providers/gemini.provider.ts` (+ `apps/api/src/modules/inbody/vision.ts`) to import a shared extractor; modify `apps/api/package.json` (add `google-auth-library`).

**Interfaces — Produces:** `AiProviderName.VERTEX`; `interface TokenProvider { getAccessToken(): Promise<string> }`; `defaultTokenProvider(): TokenProvider`; `vertexGenerateContentUrl(project, location, model): string`; `extractGeminiText(json: unknown): string` (extracted from the two existing duplicate copies).

- [ ] **Step 1:** Add `VERTEX = 'vertex'` to `AiProviderName` (`packages/shared/src/enums/index.ts`). Build shared: `pnpm --filter @gigaflow/shared build`.

- [ ] **Step 2: Failing test — `vertex-auth.test.ts`:**
```typescript
import { vertexGenerateContentUrl } from './vertex-auth.js';
it('uses the unprefixed host for global', () => {
  expect(vertexGenerateContentUrl('p', 'global', 'gemini-2.5-flash')).toBe(
    'https://aiplatform.googleapis.com/v1/projects/p/locations/global/publishers/google/models/gemini-2.5-flash:generateContent');
});
it('uses the region-prefixed host otherwise', () => {
  expect(vertexGenerateContentUrl('p', 'us-central1', 'gemini-2.5-flash')).toBe(
    'https://us-central1-aiplatform.googleapis.com/v1/projects/p/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent');
});
```
Run: `pnpm --filter @gigaflow/api test vertex-auth` → FAIL.

- [ ] **Step 3: Implement `vertex-auth.ts`:** `TokenProvider` interface; `vertexGenerateContentUrl` (host = `location === 'global' ? 'https://aiplatform.googleapis.com' : \`https://${location}-aiplatform.googleapis.com\``; path as above); `defaultTokenProvider()` → `{ getAccessToken: async () => { const t = await new GoogleAuth({ scopes:['https://www.googleapis.com/auth/cloud-platform'] }).getAccessToken(); if (!t) throw new Error('Vertex: no ADC access token'); return t; } }`. Add `google-auth-library` to `apps/api/package.json` deps (run `pnpm install`). Run → PASS.

- [ ] **Step 4: Extract `extractGeminiText`:** move the identical `extractText` (in `gemini.provider.ts` and `inbody/vision.ts`) into a shared exported `extractGeminiText` (put it in `apps/api/src/modules/ai/gemini-parse.ts` or reuse `vertex-auth.ts` — pick one and import it in both `gemini.provider.ts` and `inbody/vision.ts`), deleting both local copies. Existing gemini/vision tests must still pass. Run `pnpm --filter @gigaflow/api test` → PASS.

- [ ] **Step 5: Verify + commit — Thành Duy.**
```bash
pnpm --filter @gigaflow/shared test && pnpm --filter @gigaflow/api test && pnpm typecheck
git add packages/shared apps/api/src/modules apps/api/package.json pnpm-lock.yaml
git -c user.name="Duong Thanh Duy" -c user.email="duongduyy1512@gmail.com" commit -m "feat(api): add Vertex enum, ADC token/url helpers, shared Gemini text extractor"
```

---

### Task 2: VertexProvider (text) — TDD — [Thành Duy]

**Files:** create `apps/api/src/modules/ai/providers/vertex.provider.ts`, `apps/api/src/modules/ai/providers/vertex.provider.test.ts`.

**Interfaces — Consumes:** `AiProvider`/`AiPrompt`, `TokenProvider`, `vertexGenerateContentUrl`, `extractGeminiText`. **Produces:** `class VertexProvider implements AiProvider` — `constructor(config: { project: string; location: string; model: string }, deps?: { tokenProvider?: TokenProvider; fetchImpl?: typeof fetch })`.

- [ ] **Step 1: Failing test** (fake token + fetchImpl):
```typescript
it('posts a bearer token to the vertex url and parses the JSON candidate', async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  const fetchImpl = (async (url: string, init?: RequestInit) => { seen = { url: String(url), init };
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"name":"P","templates":[]}' }] } }] }), { status: 200 }); }) as unknown as typeof fetch;
  const p = new VertexProvider({ project: 'proj', location: 'global', model: 'gemini-2.5-flash' },
    { tokenProvider: { getAccessToken: async () => 'tok123' }, fetchImpl });
  const out = await p.generatePlan({ system: 's', user: 'u' });
  expect(out).toEqual({ name: 'P', templates: [] });
  expect(seen?.url).toContain('/projects/proj/locations/global/publishers/google/models/gemini-2.5-flash:generateContent');
  expect((seen?.init?.headers as Record<string,string>).Authorization).toBe('Bearer tok123');
});
it('throws on a non-2xx response', async () => {
  const fetchImpl = (async () => new Response('nope', { status: 403 })) as unknown as typeof fetch;
  const p = new VertexProvider({ project: 'proj', location: 'global', model: 'm' }, { tokenProvider: { getAccessToken: async () => 't' }, fetchImpl });
  await expect(p.generatePlan({ system: 's', user: 'u' })).rejects.toThrow(/403/);
});
```
Run → FAIL.

- [ ] **Step 2: Implement `VertexProvider`** (`name = AiProviderName.VERTEX`; default `tokenProvider = defaultTokenProvider()`, `fetchImpl = fetch`; POST body `{ contents:[{ role:'user', parts:[{ text:\`${prompt.system}\n\n${prompt.user}\` }] }], generationConfig:{ responseMimeType:'application/json' } }`; `Authorization: Bearer <token>`; non-2xx → throw with status; `JSON.parse(extractGeminiText(await res.json()))`). No `any`. Run → PASS.

- [ ] **Step 3: Commit — Thành Duy.** (`feat(api): add Vertex AI text provider`)

---

### Task 3: Provider order/config in the factories — TDD — [Thành Duy]

**Files:** modify `apps/api/src/modules/ai/ai.factory.ts`; test `apps/api/src/modules/ai/ai.factory.test.ts` (create/extend).

**Interfaces — Produces:** `resolveProviderOrder(kind: 'workout'|'meal'): AiProviderName[]` (reads `AI_PROVIDER_ORDER`, defaults `[gemini, openai]` / `[gemini]`); `buildAiEngine()`/`buildMealAiEngine()` build the ordered, configured provider list including Vertex when requested + a project id is present (`VERTEX_PROJECT_ID ?? GCP_PROJECT_ID`, `VERTEX_LOCATION ?? 'global'`, `VERTEX_MODEL ?? 'gemini-2.5-flash'`).

- [ ] **Step 1: Failing test** (set/restore `process.env` per case): with `AI_PROVIDER_ORDER='vertex,gemini'` + `GCP_PROJECT_ID='p'` + `GEMINI_API_KEY='k'` → `buildAiEngine()` yields providers named `[vertex, gemini]` in order (expose the provider names for assertion — e.g. a test-only getter or assert via a spy that Vertex is tried first); no `AI_PROVIDER_ORDER` → unchanged `[gemini, openai]` when both keys set; Vertex omitted when no project id even if listed. Run → FAIL.

- [ ] **Step 2: Implement** `resolveProviderOrder` + rewire both factories to iterate the resolved order, adding each provider only when configured (Gemini↔`GEMINI_API_KEY`, OpenAI↔`OPENAI_API_KEY`, Vertex↔project id). Empty → `UnconfiguredAiProvider`. Keep defaults exactly as today when no new env. To make providers assertable, give `AiEngine` a readonly `providerNames: AiProviderName[]` getter (or expose the array) — small, test-supporting, no behavior change. Run → PASS.

- [ ] **Step 3: Commit — Thành Duy.** (`feat(api): config-driven AI provider order with Vertex`)

---

### Task 4: VertexVisionAnalyzer (InBody) — TDD — [Thành Duy]

**Files:** create `apps/api/src/modules/inbody/vertex-vision.ts`, `apps/api/src/modules/inbody/vertex-vision.test.ts`; modify `apps/api/src/modules/inbody/vision.factory.ts`.

**Interfaces — Consumes:** `VisionAnalyzer`/`VisionAnalyzeInput`, `TokenProvider`, `vertexGenerateContentUrl`, `extractGeminiText`. **Produces:** `class VertexVisionAnalyzer implements VisionAnalyzer`; `buildInbodyAnalyzer()` returns it when Vertex requested + configured.

- [ ] **Step 1: Failing test** (fake token + fetchImpl): `analyze({imageBase64:'b64', mimeType:'image/png', prompt:'p'})` posts `inline_data:{mime_type,data}` + a text part to the vertex url with the Bearer token, and returns the parsed JSON from the candidate. Run → FAIL.

- [ ] **Step 2: Implement `VertexVisionAnalyzer`** (body `contents:[{ role:'user', parts:[{ inline_data:{ mime_type: input.mimeType, data: input.imageBase64 } }, { text: input.prompt }] }], generationConfig:{ responseMimeType:'application/json' }`; Bearer token; non-2xx throw; `JSON.parse(extractGeminiText(await res.json()))`) + update `buildInbodyAnalyzer()` to return it when `resolveProviderOrder`/an `AI_USE_VERTEX`-style check selects Vertex and a project id exists, else the existing `GeminiVisionAnalyzer`, else unconfigured. No `any`. Run → PASS.

- [ ] **Step 3: Commit — Thành Duy.** (`feat(api): add Vertex vision analyzer for InBody`)

---

### Task 5: Env + Terraform + docs — [Bảo Hân]

**Files:** modify `.env.example`; modify `infra/envs/dev/main.tf` and `infra/envs/prod/main.tf`; modify `infra/README.md`; modify `README.md`.

- [ ] **Step 1: `.env.example`** — add commented `VERTEX_PROJECT_ID=` (falls back to `GCP_PROJECT_ID`), `VERTEX_LOCATION=global`, `VERTEX_MODEL=gemini-2.5-flash`, `AI_PROVIDER_ORDER=` (e.g. `vertex,gemini,openai`), with a note that Vertex uses ADC (no key; `gcloud auth application-default login` locally).

- [ ] **Step 2: Terraform** — in `infra/envs/dev/main.tf` (+ prod) add `google_project_iam_member` granting the `gigaflow-api` SA `roles/aiplatform.user`; add `aiplatform.googleapis.com` to the enabled-APIs note in `infra/README.md`. `terraform fmt` the changed files. (No secret — ADC.)

- [ ] **Step 3: README** — under the AI section, document the Vertex provider: parallel with AI Studio Gemini + OpenAI, selected via `AI_PROVIDER_ORDER`, ADC auth, and that it lets AI run through Vertex/GCP (credit-eligible if the promotion covers Vertex Gemini SKUs). Note it's opt-in (no env change → unchanged behavior).

- [ ] **Step 4: Commit — Bảo Hân.** (`docs: document Vertex AI provider, env, and Terraform IAM`)

---

## Self-Review

**1. Spec coverage:** enum + auth/url helpers + shared extractor (T1); text VertexProvider (T2); factory order/config (T3); Vertex vision for InBody (T4); env + Terraform IAM + docs (T5). Non-goals (real calls/credit verify, streaming, removing AI Studio/OpenAI) excluded per spec §5. Every spec §3 piece mapped.

**2. Placeholder scan:** providers/helpers/factory have concrete signatures + real tests (URL, Bearer, parse, non-2xx, order); `defaultTokenProvider` is thin real-ADC, explicitly not unit-tested (like other real-SDK seams). Terraform is a concrete IAM member add. No vague directives.

**3. Type consistency:** `AiProviderName.VERTEX` (T1) used by VertexProvider (T2), factory (T3), vision (T4). `TokenProvider`/`vertexGenerateContentUrl`/`extractGeminiText` (T1) consumed by T2 + T4. `AiProvider`/`AiPrompt` + `VisionAnalyzer`/`VisionAnalyzeInput` reused unchanged. `resolveProviderOrder` (T3) + env names (`VERTEX_*`, `AI_PROVIDER_ORDER`) consistent across T3/T4/T5. `AiEngine.providerNames` getter added in T3 supports the order assertions. Each task green on api (+shared for T1) + typecheck.

**Assignees:** T1–T4 → Thành Duy; T5 → Bảo Hân.

**Execution gate:** run only after Billing confirms the credit covers Vertex AI Gemini SKUs (or the user opts to ship it anyway for unified Cloud Run auth).
