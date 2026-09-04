#!/usr/bin/env bash
#
# Manual deploy for GigaFlow — no Cloud Build needed.
#
#   ./scripts/deploy.sh [dev|prod]
#
# Steps: build & push the API image → `terraform apply` (rolls out the image +
# env from terraform.tfvars on Cloud Run) → build the web app → `firebase deploy`
# hosting → health check. Run from the repo root.
#
# Prerequisites (one-time): gcloud + docker + terraform + firebase CLIs installed;
# `gcloud auth login`, `firebase login`; `infra/envs/<env>/terraform.tfvars` filled
# and `terraform init` already run in that dir; `apps/web/.env` filled with the
# VITE_* values (baked into the web build).
#
# Overrides (env vars): PROJECT, REGION, REPO, TAG, AUTO_APPROVE=1,
#   SKIP_API=1 (web only), SKIP_WEB=1 (api only).

set -euo pipefail

ENV="${1:-dev}"
case "$ENV" in
  dev | prod) ;;
  *) echo "usage: $0 [dev|prod]" >&2; exit 2 ;;
esac

# Repo root check
if [[ ! -f "pnpm-workspace.yaml" || ! -d "infra/envs/$ENV" ]]; then
  echo "error: run this from the repo root (infra/envs/$ENV not found)" >&2
  exit 1
fi

PROJECT="${PROJECT:-gigaflow-$ENV}"
REGION="${REGION:-asia-southeast1}"
REPO="${REPO:-gigaflow}"
TAG="${TAG:-$(git rev-parse --short HEAD 2>/dev/null || date +%Y%m%d-%H%M%S)}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT}/${REPO}/api:${TAG}"

for bin in gcloud docker terraform firebase pnpm; do
  command -v "$bin" >/dev/null || { echo "error: '$bin' not found in PATH" >&2; exit 1; }
done

echo "▶ Deploying GigaFlow [$ENV]  project=$PROJECT  image tag=$TAG"

# ── 1. API: build + push image, then terraform apply ─────────────────────────
if [[ "${SKIP_API:-0}" != "1" ]]; then
  echo "▶ [api] build & push $IMAGE"
  gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
  docker build -f apps/api/Dockerfile -t "$IMAGE" .
  docker push "$IMAGE"

  echo "▶ [api] terraform apply (Cloud Run image + env from terraform.tfvars)"
  APPROVE_FLAG=""
  [[ "${AUTO_APPROVE:-0}" == "1" ]] && APPROVE_FLAG="-auto-approve"
  ( cd "infra/envs/$ENV" && terraform apply $APPROVE_FLAG -var "image=${IMAGE}" )
fi

API_URL="$( cd "infra/envs/$ENV" && terraform output -raw api_url 2>/dev/null || true )"

# ── 2. Web: build + firebase deploy hosting ──────────────────────────────────
if [[ "${SKIP_WEB:-0}" != "1" ]]; then
  echo "▶ [web] install + build (bakes apps/web/.env VITE_* values)"
  pnpm install --frozen-lockfile
  pnpm --filter @gigaflow/web build     # → apps/web/dist (served per firebase.json)

  echo "▶ [web] firebase deploy hosting → $PROJECT"
  firebase deploy --only hosting --project "$PROJECT" --non-interactive
fi

# ── 3. Health check ──────────────────────────────────────────────────────────
if [[ -n "$API_URL" ]]; then
  echo "▶ health check ${API_URL}/api/health"
  if curl -fsS "${API_URL}/api/health" >/dev/null; then
    echo "  ✓ API healthy"
  else
    echo "  ✗ API health check failed (${API_URL}/api/health)" >&2
    exit 1
  fi
fi

echo "✔ Deploy [$ENV] complete."
[[ -n "$API_URL" ]] && echo "  API:     $API_URL"
echo "  Hosting: https://${PROJECT}.web.app"
