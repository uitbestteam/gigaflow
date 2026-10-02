# Using the Agent Builder credit for GigaFlow's AI (research — no code yet)

**Goal:** draw AI generation cost down from a Google Cloud credit that is scoped to
**Vertex AI Agent Builder / Vertex AI Search** SKUs (`discoveryengine.googleapis.com`),
instead of the **Gemini prediction** SKUs that our current Vertex call bills to.

> Status: **research only.** Nothing here is wired up. Section 6 is the checklist to
> validate _before_ writing any code — item 1 (credit scope) can kill the whole idea.

---

## 1. What we do today

`apps/api/src/modules/ai/providers/vertex.provider.ts` +
`apps/api/src/modules/ai/vertex-auth.ts` call:

```
POST https://{LOC}-aiplatform.googleapis.com/v1/projects/{PROJECT}/locations/{LOC}/publishers/google/models/gemini-2.5-flash:generateContent
```

(`LOC` = `global` → `aiplatform.googleapis.com`). This is the **standard Vertex AI
Gemini prediction** path. On the bill it lands under the **Vertex AI → Gemini /
online-prediction** SKUs — the ones the credit reportedly does **not** cover.

Auth: ADC access token (`google-auth-library`, `cloud-platform` scope) from the Cloud
Run runtime service account. Selected via `AI_PROVIDER_ORDER=vertex` +
`VERTEX_MODEL`/`VERTEX_LOCATION` (`apps/api/src/modules/ai/ai.factory.ts`).

## 2. The correct Agent Builder API for our use case

Our AI use case is **pure structured generation** (workout/meal plan → JSON) from a
prompt — **no data store, no RAG, no search**. So the conversational/search APIs in the
example (`ConversationalSearchServiceClient.converseConversation`, the `:converse` /
`:answer` endpoints) are the **wrong fit**: they require a provisioned **App/Engine +
Data Store**. Standing up a data store just to get raw model output is overkill and
awkward.

The right API is **Grounded Generation** on the Discovery Engine service, which can
generate text **with or without** grounding — omit the grounding sources and it behaves
like a plain prompt→text call, but billed on the **Agent Builder / Vertex AI Search**
side:

```
POST https://discoveryengine.googleapis.com/v1/projects/{PROJECT_NUMBER}/locations/global:generateGroundedContent
Authorization: Bearer <ADC access token>   # same SA/ADC we already use
Content-Type: application/json

{
  "contents": [
    { "role": "user", "parts": [{ "text": "<user prompt>" }] }
  ],
  "systemInstruction": { "parts": { "text": "<system prompt>" } },
  "generationSpec": { "modelId": "gemini-2.5-flash", "temperature": 0.7 }
  // NO "groundingSpec" → no Google Search / data-store grounding → plain generation
}
```

- Host: `discoveryengine.googleapis.com` (this is the SKU that the credit should cover).
- Location: **`global`** in the URL path (grounded generation is a global endpoint).
- Path uses the **project _number_** (not the project id) — see §6.4.
- Model: `gemini-2.5-flash` (same model family we use now).
- Response: a Gemini-style `candidates[]` payload **plus** grounding metadata — the shape
  is **not identical** to `:generateContent`, so our `gemini-parse.ts#extractGeminiText`
  needs a small variant (see §5).

Docs: [Generate grounded answers with RAG](https://docs.cloud.google.com/generative-ai-app-builder/docs/grounded-gen) ·
[Get answers and follow-ups](https://docs.cloud.google.com/generative-ai-app-builder/docs/answer) ·
[Agent Builder docs](https://docs.cloud.google.com/agent-builder).

## 3. Billing / SKU

- `discoveryengine.googleapis.com` calls bill under the **Vertex AI Search** SKU group
  ([SKU group](https://cloud.google.com/skus/sku-groups/vertex-ai-search)), priced for
  Agent Builder as **generative-answer / grounded-generation** (character- or
  token-based on input+output), separate from the Gemini online-prediction SKUs.
  Pricing: [Agent Search pricing](https://cloud.google.com/generative-ai-app-builder/pricing) ·
  [Agent Platform pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing).
- ⚠️ **Nuance to verify (see §6.2):** Google's docs note that for *Grounding with Google
  Search*, "standard Gemini model usage fees also apply". For grounded generation **without**
  a grounding source it should bill purely on the Agent Builder grounded-generation SKU, but
  this must be confirmed against a real bill line — it's the crux of whether this saves the
  credit at all.

## 4. Credit scope — verify FIRST (this can void everything)

A Google Cloud credit only helps if its **Scope** includes these SKUs. Credit scope is
**account-specific** and cannot be inferred from code. Check it:

- Console → **Billing → Credits** → the credit row shows a **Scope** column when it is
  restricted to particular services/SKUs (and Status / Remaining / End date).
- Or **Billing → Reports** filtered by credit, or the **BigQuery billing export** for
  per-SKU credit application.
  [View credits & savings](https://docs.cloud.google.com/billing/docs/how-to/reports/savings-and-credits).

If the credit's scope is **Vertex AI Search / Agent Builder / Discovery Engine**, this
plan works. If it's actually broad (all Vertex AI) or a different product, we may not need
to change anything (or a different fix is needed).

## 5. How it would slot into this repo (design, not built)

Mirror the existing provider pattern — smallest possible blast radius:

1. **New provider** `apps/api/src/modules/ai/providers/agent-builder.provider.ts`
   implementing the same `AiProvider` interface (`generatePlan(prompt) → unknown`),
   POSTing to `:generateGroundedContent`. Reuse `defaultTokenProvider()` (ADC) from
   `vertex-auth.ts` — auth is identical.
2. **New URL/parse helpers** next to `vertex-auth.ts` / `gemini-parse.ts`
   (`generateGroundedContentUrl(projectNumber)`, `extractGroundedText(json)` for the
   grounded-generation response shape).
3. **Enum + factory:** add `AiProviderName.AGENT_BUILDER = 'agentbuilder'`
   (`packages/shared/src/enums`), a `case` in `ai.factory.ts#buildProvider`, so it's
   selectable via `AI_PROVIDER_ORDER=agentbuilder,vertex,gemini` (keeps the existing
   fallback chain — Agent Builder first, current Vertex/Gemini as safety net).
4. **Env:** `AGENT_BUILDER_MODEL` (default `gemini-2.5-flash`), and a project **number**
   value (new env, since the path needs the number — `GCP_PROJECT_ID` is the id).
5. **Infra (terraform):** enable `discoveryengine.googleapis.com` in
   `infra/envs/dev/services.tf`, and grant the runtime SA `roles/discoveryengine.user`
   (alongside the existing `roles/aiplatform.user`).

No web/frontend change — the AI engine is entirely backend, behind the job pipeline.

## 6. Validate BEFORE coding

1. **Credit scope** (§4): confirm the credit covers the Vertex AI Search / Agent Builder /
   `discoveryengine` SKUs. **If not, stop** — coding won't help.
2. **Billing proof:** make one real `:generateGroundedContent` call (no grounding), wait
   for the cost to land, and confirm in Billing Reports that it hit the **Agent Builder /
   Vertex AI Search** SKU **and** was covered by the credit (not the Gemini SKU).
3. **JSON output:** our generators need strict JSON. `:generateContent` supports
   `generationConfig.responseMimeType:"application/json"`; grounded generation's
   `generationSpec` may **not** expose the same JSON-mode / response-schema knobs. Verify
   whether we can still get reliable JSON (response-schema support, or fall back to
   prompt-instructed JSON + our existing tolerant parse). This is the biggest technical risk.
4. **Project number vs id:** the endpoint path shows `projects/{PROJECT_NUMBER}`. Confirm
   whether the project **id** is also accepted; if not, thread the number through env.
5. **Region:** grounded generation is `global`-only in the path — fine for us, but note it.
6. **Quotas/latency:** compare latency + quota of grounded-generation vs the current Vertex
   path under our Cloud Tasks job flow (it already tolerates 10–30s async, so likely fine).

## 7. TL;DR

- Keep the model (`gemini-2.5-flash`); **change the endpoint** from
  `aiplatform.googleapis.com …:generateContent` → `discoveryengine.googleapis.com
  …:generateGroundedContent` (no grounding source) so cost bills to the Agent Builder /
  Vertex AI Search SKU the credit covers.
- Not the `:converse`/`:answer` conversational-search APIs (those need a data store).
- **Gate everything on §6.1–6.2**: confirm the credit's scope and that the call actually
  bills to (and is drawn from) that credit before we build the provider.
