# ---- builder ----
FROM node:22-slim AS builder
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @gigaflow/shared build && pnpm --filter @gigaflow/api build

# ---- prod deps ----
FROM node:22-slim AS proddeps
WORKDIR /app
RUN corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --prod

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=proddeps /app/node_modules ./node_modules
COPY --from=proddeps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=proddeps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
