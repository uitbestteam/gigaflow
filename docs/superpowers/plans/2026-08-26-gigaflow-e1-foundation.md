# E1 — Foundation & Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng monorepo GigaFlow chạy được local + deploy được lên GCP (Cloud Run + Firebase Hosting) với CI/CD, làm nền cho mọi epic sau.

**Architecture:** Monorepo pnpm + Turborepo với `apps/api` (Hono trên Cloud Run), `apps/web` (chưa dựng ở E1, chỉ tạo placeholder khi cần Hosting), và `packages/shared` (Zod schema + type dùng chung). Backend dùng MongoDB native driver + Zod, jobs qua Cloud Tasks. Hạ tầng GCP quản lý bằng Terraform (trừ Atlas — tạo tay, URI vào Secret Manager). Web served qua Firebase Hosting với rewrite `/api/**` → Cloud Run (same-origin).

**Tech Stack:** TypeScript 5, pnpm 10 workspaces, Turborepo, Hono 4 + @hono/node-server, Zod 3, mongodb (native driver) 6, Vitest, mongodb-memory-server, Docker (node:22-slim), Terraform (google provider), Firebase Hosting, Cloud Build.

**Spec:**
- `docs/superpowers/specs/2026-08-26-gigaflow-cloud-architecture-design.md`
- `docs/superpowers/specs/2026-08-26-gigaflow-features-spec.md` (Epic E1)

## Global Constraints

- **Node:** dev ≥ 20; container base **node:22-slim** (Node 22 LTS). `engines.node` = `>=20`.
- **Package manager:** pnpm (workspaces). Không dùng npm/yarn install.
- **TypeScript strict:** `strict: true`, KHÔNG dùng `any`, mọi export có kiểu tường minh.
- **Zod single source:** mọi DTO/entity định nghĩa một lần trong `packages/shared`; api validate bằng chính schema đó.
- **Response envelope thống nhất:** `{ success: boolean; data?: T; message?: string }`.
- **GCP region:** `asia-southeast1`. GCP project id: đặt biến `GCP_PROJECT_ID` (ví dụ `gigaflow-dev`), owner `uitbestteam@gmail.com`.
- **Secrets:** Atlas URI + AI keys nằm trong Secret Manager, KHÔNG commit vào repo. `.env` chỉ dùng local và phải gitignore.
- **Auth token:** request người dùng dùng Firebase ID token (epic E2); route `/internal/tasks/*` dùng OIDC của Cloud Tasks — ở E1 chỉ dựng khung verify, chưa nối logic.
- **Commit:** thường xuyên, mỗi task ≥ 1 commit; message theo Conventional Commits.

---

## File Structure

```
gigaflow/
├─ package.json                      # root: workspaces, scripts, devDeps chung
├─ pnpm-workspace.yaml
├─ turbo.json
├─ tsconfig.base.json                # config TS gốc, các package extends
├─ .env.example
├─ .gitignore                        # (đã có) — bổ sung .env, dist, coverage
├─ packages/
│  └─ shared/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ enums/index.ts           # Language (+ mở rộng sau)
│     │  ├─ schemas/common.ts        # zTranslatable, zObjectId, apiResponse helpers
│     │  ├─ types.ts                 # ApiResponse<T>, Translatable
│     │  └─ index.ts                 # barrel export
│     └─ src/schemas/common.test.ts
├─ apps/
│  └─ api/
│     ├─ package.json
│     ├─ tsconfig.json
│     ├─ Dockerfile
│     ├─ .dockerignore
│     ├─ src/
│     │  ├─ lib/db.ts                # Mongo native client singleton
│     │  ├─ middleware/error.ts      # onError → envelope
│     │  ├─ middleware/internal-auth.ts  # verify OIDC (khung)
│     │  ├─ modules/health/health.routes.ts
│     │  ├─ app.ts                   # createApp(): Hono
│     │  └─ index.ts                 # @hono/node-server, listen PORT
│     └─ src/**/*.test.ts
├─ infra/
│  ├─ envs/dev/{main.tf,variables.tf,backend.tf,terraform.tfvars.example}
│  └─ modules/
│     ├─ cloud-run/{main.tf,variables.tf,outputs.tf}
│     ├─ secrets/{main.tf,variables.tf,outputs.tf}
│     └─ cloud-tasks/{main.tf,variables.tf,outputs.tf}
├─ firebase.json                     # Hosting + rewrite /api/** → Cloud Run
├─ .firebaserc
└─ cloudbuild.yaml                   # CI/CD
```

---

### Task 1: Monorepo scaffold (pnpm + Turborepo + TS base)

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`
- Modify: `.gitignore`
- Create: `.env.example`

**Interfaces:**
- Consumes: —
- Produces: workspace root với scripts `build`, `test`, `lint`, `typecheck` chạy qua turbo; `tsconfig.base.json` để mọi package `extends`.

- [ ] **Step 1: Tạo `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 2: Tạo `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

- [ ] **Step 3: Tạo `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "lint": {}
  }
}
```

- [ ] **Step 4: Tạo root `package.json`**

```json
{
  "name": "gigaflow",
  "private": true,
  "packageManager": "pnpm@10.34.1",
  "engines": { "node": ">=20" },
  "scripts": {
    "build": "turbo build",
    "test": "turbo test",
    "typecheck": "turbo typecheck",
    "lint": "turbo lint"
  },
  "devDependencies": {
    "turbo": "^2.3.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 5: Bổ sung `.gitignore`**

Thêm các dòng (giữ nội dung cũ):

```
.env
.env.*
!.env.example
dist/
coverage/
.turbo/
*.tfstate
*.tfstate.*
.terraform/
```

- [ ] **Step 6: Tạo `.env.example`**

```
# Local dev
PORT=8080
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=gigaflow
GCP_PROJECT_ID=gigaflow-dev
```

- [ ] **Step 7: Cài deps root**

Run: `pnpm install`
Expected: tạo `pnpm-lock.yaml`, không lỗi.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml turbo.json tsconfig.base.json .gitignore .env.example pnpm-lock.yaml
git commit -m "chore: scaffold pnpm + turborepo monorepo"
```

---

### Task 2: `packages/shared` — Zod base + types (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/{index.ts,types.ts,enums/index.ts,schemas/common.ts}`
- Test: `packages/shared/src/schemas/common.test.ts`

**Interfaces:**
- Consumes: `tsconfig.base.json`.
- Produces:
  - `Language` enum: `{ EN='en', VI='vi' }`.
  - `zTranslatable: ZodObject` → type `Translatable = { en: string; vi: string }`.
  - `zObjectId: ZodString` (validate 24-hex).
  - `type ApiResponse<T> = { success: boolean; data?: T; message?: string }`.
  - `apiSuccess<T>(data: T, message?: string): ApiResponse<T>`.

- [ ] **Step 1: Tạo `packages/shared/package.json`**

```json
{
  "name": "@gigaflow/shared",
  "version": "0.0.0",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit",
    "build": "tsc"
  },
  "dependencies": { "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0" }
}
```

- [ ] **Step 2: Tạo `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

- [ ] **Step 3: Cài deps**

Run: `pnpm install`
Expected: `zod` xuất hiện trong `packages/shared/node_modules` (hoặc hoisted).

- [ ] **Step 4: Viết test thất bại — `packages/shared/src/schemas/common.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { zTranslatable, zObjectId, apiSuccess, Language } from '../index';

describe('shared schemas', () => {
  it('accepts a valid translatable', () => {
    const r = zTranslatable.safeParse({ en: 'Bench', vi: 'Đẩy ngực' });
    expect(r.success).toBe(true);
  });
  it('rejects a translatable missing vi', () => {
    const r = zTranslatable.safeParse({ en: 'Bench' });
    expect(r.success).toBe(false);
  });
  it('validates 24-hex object id', () => {
    expect(zObjectId.safeParse('651f1f77bcf86cd799439011').success).toBe(true);
    expect(zObjectId.safeParse('not-an-id').success).toBe(false);
  });
  it('wraps data in success envelope', () => {
    expect(apiSuccess({ x: 1 }, 'ok')).toEqual({ success: true, data: { x: 1 }, message: 'ok' });
  });
  it('exposes Language enum', () => {
    expect(Language.VI).toBe('vi');
  });
});
```

- [ ] **Step 5: Chạy test — xác nhận FAIL**

Run: `pnpm --filter @gigaflow/shared test`
Expected: FAIL (module `../index` / exports chưa tồn tại).

- [ ] **Step 6: Tạo `packages/shared/src/enums/index.ts`**

```typescript
export enum Language {
  EN = 'en',
  VI = 'vi',
}
```

- [ ] **Step 7: Tạo `packages/shared/src/schemas/common.ts`**

```typescript
import { z } from 'zod';

export const zTranslatable = z.object({
  en: z.string(),
  vi: z.string(),
});

export const zObjectId = z.string().regex(/^[a-f0-9]{24}$/i, 'invalid ObjectId');
```

- [ ] **Step 8: Tạo `packages/shared/src/types.ts`**

```typescript
import { z } from 'zod';
import { zTranslatable } from './schemas/common';

export type Translatable = z.infer<typeof zTranslatable>;

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

export function apiSuccess<T>(data: T, message?: string): ApiResponse<T> {
  return { success: true, data, ...(message ? { message } : {}) };
}
```

- [ ] **Step 9: Tạo `packages/shared/src/index.ts`**

```typescript
export * from './enums';
export * from './schemas/common';
export * from './types';
```

- [ ] **Step 10: Chạy test — xác nhận PASS**

Run: `pnpm --filter @gigaflow/shared test`
Expected: PASS (5 test).

- [ ] **Step 11: Commit**

```bash
git add packages/shared pnpm-lock.yaml
git commit -m "feat(shared): add Zod base schemas, enums, and ApiResponse envelope"
```

---

### Task 3: `apps/api` — Hono app factory + health route (TDD)

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`
- Create: `apps/api/src/{app.ts,middleware/error.ts,modules/health/health.routes.ts}`
- Test: `apps/api/src/modules/health/health.test.ts`

**Interfaces:**
- Consumes: `@gigaflow/shared` (`apiSuccess`, `ApiResponse`).
- Produces:
  - `createApp(): Hono` — instance đã gắn error middleware + mount health.
  - `GET /health` → 200 `{ success:true, data:{ status:'ok', uptime:number, env:string } }`.
  - `GET /health/ready` → 200 `{ success:true, data:{ ready:true } }`.

- [ ] **Step 1: Tạo `apps/api/package.json`**

```json
{
  "name": "@gigaflow/api",
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@gigaflow/shared": "workspace:*",
    "hono": "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "mongodb": "^6.10.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "vitest": "^2.1.0",
    "tsx": "^4.19.0",
    "mongodb-memory-server": "^10.1.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Tạo `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src", "module": "ESNext" },
  "include": ["src"]
}
```

- [ ] **Step 3: Cài deps**

Run: `pnpm install`
Expected: hono, @hono/node-server, mongodb, tsx cài xong.

- [ ] **Step 4: Viết test thất bại — `apps/api/src/modules/health/health.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { createApp } from '../../app';

describe('health', () => {
  it('GET /health returns ok envelope', async () => {
    const app = createApp();
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
  });
  it('GET /health/ready returns ready', async () => {
    const app = createApp();
    const res = await app.request('/health/ready');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.ready).toBe(true);
  });
  it('unknown route returns error envelope 404', async () => {
    const app = createApp();
    const res = await app.request('/nope');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});
```

- [ ] **Step 5: Chạy test — xác nhận FAIL**

Run: `pnpm --filter @gigaflow/api test`
Expected: FAIL (`createApp` chưa tồn tại).

- [ ] **Step 6: Tạo `apps/api/src/middleware/error.ts`**

```typescript
import type { Context } from 'hono';
import type { ApiResponse } from '@gigaflow/shared';

export function errorBody(message: string): ApiResponse<never> {
  return { success: false, message };
}

export function onError(err: Error, c: Context): Response {
  const status = 'status' in err && typeof err.status === 'number' ? err.status : 500;
  const message = status === 500 ? 'Internal server error' : err.message;
  return c.json(errorBody(message), status as 500);
}

export function notFound(c: Context): Response {
  return c.json(errorBody('Not found'), 404);
}
```

- [ ] **Step 7: Tạo `apps/api/src/modules/health/health.routes.ts`**

```typescript
import { Hono } from 'hono';
import { apiSuccess } from '@gigaflow/shared';

export const health = new Hono();

health.get('/', (c) =>
  c.json(apiSuccess({ status: 'ok', uptime: process.uptime(), env: process.env.NODE_ENV ?? 'development' })),
);

health.get('/ready', (c) => c.json(apiSuccess({ ready: true })));
health.get('/live', (c) => c.json(apiSuccess({ alive: true })));
```

- [ ] **Step 8: Tạo `apps/api/src/app.ts`**

```typescript
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { onError, notFound } from './middleware/error';
import { health } from './modules/health/health.routes';

export function createApp(): Hono {
  const app = new Hono();
  app.use('*', logger());
  app.route('/health', health);
  app.notFound(notFound);
  app.onError(onError);
  return app;
}
```

- [ ] **Step 9: Chạy test — xác nhận PASS**

Run: `pnpm --filter @gigaflow/api test`
Expected: PASS (3 test).

- [ ] **Step 10: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add Hono app factory with health routes and error envelope"
```

---

### Task 4: Mongo client singleton (TDD với mongodb-memory-server)

**Files:**
- Create: `apps/api/src/lib/db.ts`
- Test: `apps/api/src/lib/db.test.ts`

**Interfaces:**
- Consumes: env `MONGODB_URI`, `MONGODB_DB`.
- Produces:
  - `connectDb(uri: string, dbName: string): Promise<Db>` — kết nối, cache client.
  - `getDb(): Db` — throw nếu chưa connect.
  - `closeDb(): Promise<void>`.

- [ ] **Step 1: Viết test thất bại — `apps/api/src/lib/db.test.ts`**

```typescript
import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectDb, getDb, closeDb } from './db';

let mongod: MongoMemoryServer;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await connectDb(mongod.getUri(), 'gigaflow_test');
});

afterAll(async () => {
  await closeDb();
  await mongod.stop();
});

describe('db', () => {
  it('getDb returns a usable Db after connect', async () => {
    const db = getDb();
    await db.collection('ping').insertOne({ ok: 1 });
    const doc = await db.collection('ping').findOne({ ok: 1 });
    expect(doc?.ok).toBe(1);
  });
});
```

- [ ] **Step 2: Chạy test — xác nhận FAIL**

Run: `pnpm --filter @gigaflow/api test src/lib/db.test.ts`
Expected: FAIL (`./db` chưa tồn tại).

- [ ] **Step 3: Tạo `apps/api/src/lib/db.ts`**

```typescript
import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(uri: string, dbName: string): Promise<Db> {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db(dbName);
  return db;
}

export function getDb(): Db {
  if (!db) throw new Error('Database not connected. Call connectDb() first.');
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
```

- [ ] **Step 4: Chạy test — xác nhận PASS**

Run: `pnpm --filter @gigaflow/api test src/lib/db.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): add MongoDB native driver client singleton"
```

---

### Task 5: Server entry + Dockerfile + local container verify

**Files:**
- Create: `apps/api/src/index.ts`, `apps/api/Dockerfile`, `apps/api/.dockerignore`

**Interfaces:**
- Consumes: `createApp` (Task 3), `connectDb` (Task 4), env `PORT`, `MONGODB_URI`, `MONGODB_DB`.
- Produces: container lắng nghe `0.0.0.0:$PORT`, phục vụ `/health`.

- [ ] **Step 1: Tạo `apps/api/src/index.ts`**

```typescript
import { serve } from '@hono/node-server';
import { createApp } from './app';
import { connectDb } from './lib/db';

const port = Number(process.env.PORT ?? 8080);

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (uri) {
    await connectDb(uri, process.env.MONGODB_DB ?? 'gigaflow');
  }
  const app = createApp();
  serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });
  console.log(`API listening on :${port}`);
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});
```

- [ ] **Step 2: Tạo `apps/api/.dockerignore`**

```
node_modules
dist
**/*.test.ts
coverage
.turbo
```

- [ ] **Step 3: Tạo `apps/api/Dockerfile`** (build từ root context để có workspace + shared)

```dockerfile
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
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
EXPOSE 8080
CMD ["node", "apps/api/dist/index.js"]
```

> Lưu ý: `@gigaflow/shared` `main` phải trỏ `dist` khi chạy container. Đảm bảo `packages/shared/package.json` có `"main": "./dist/index.js"` cho môi trường built — thêm field `"publishConfig"` hoặc dùng `exports` điều kiện. Đơn giản nhất: đổi `main`/`types`/`exports` sang `dist` và thêm script `dev` dùng tsx cho local (đã có tsx ở api). Cập nhật `packages/shared/package.json`: `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`, `"exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } }`. Chạy lại `pnpm --filter @gigaflow/shared build` trước khi test local nếu resolve theo dist.

- [ ] **Step 4: Build image**

Run: `docker build -t gigaflow-api:local -f apps/api/Dockerfile .`
Expected: build thành công tới stage runtime.

- [ ] **Step 5: Chạy container + verify health**

Run:
```bash
docker run -d --name gfapi -p 8080:8080 gigaflow-api:local
sleep 2 && curl -fs http://localhost:8080/health && echo
docker rm -f gfapi
```
Expected: JSON `{"success":true,"data":{"status":"ok",...}}`.

- [ ] **Step 6: Commit**

```bash
git add apps/api packages/shared
git commit -m "feat(api): add node-server entry and multi-stage Dockerfile"
```

---

### Task 6: Terraform skeleton — project, state, Cloud Run, secrets, SA

**Files:**
- Create: `infra/envs/dev/{backend.tf,main.tf,variables.tf,terraform.tfvars.example}`
- Create: `infra/modules/cloud-run/{main.tf,variables.tf,outputs.tf}`
- Create: `infra/modules/secrets/{main.tf,variables.tf,outputs.tf}`

**Interfaces:**
- Consumes: GCP project `var.project_id`, region `asia-southeast1`, image URL (Artifact Registry / gcr).
- Produces: Cloud Run service `gigaflow-api`, Secret Manager secrets (`mongodb-uri`, `gemini-api-key`, `openai-api-key`), runtime SA với quyền đọc secret + enqueue Cloud Tasks.

- [ ] **Step 1: Tạo GCS bucket cho TF state (một lần, thủ công)**

Run (thay project id):
```bash
gcloud storage buckets create gs://gigaflow-tfstate-dev \
  --project=gigaflow-dev --location=asia-southeast1 --uniform-bucket-level-access
```
Expected: bucket tạo thành công.

- [ ] **Step 2: Tạo `infra/envs/dev/backend.tf`**

```hcl
terraform {
  required_version = ">= 1.9"
  backend "gcs" {
    bucket = "gigaflow-tfstate-dev"
    prefix = "env/dev"
  }
  required_providers {
    google = { source = "hashicorp/google", version = "~> 6.0" }
  }
}
```

- [ ] **Step 3: Tạo `infra/envs/dev/variables.tf`**

```hcl
variable "project_id" { type = string }
variable "region"     { type = string, default = "asia-southeast1" }
variable "image"      { type = string, description = "Cloud Run container image URL" }
```

- [ ] **Step 4: Tạo `infra/modules/secrets/variables.tf` + `main.tf` + `outputs.tf`**

`variables.tf`:
```hcl
variable "project_id" { type = string }
variable "secret_ids" { type = list(string) }
```
`main.tf`:
```hcl
resource "google_secret_manager_secret" "s" {
  for_each  = toset(var.secret_ids)
  project   = var.project_id
  secret_id = each.value
  replication { auto {} }
}
```
`outputs.tf`:
```hcl
output "secret_ids" { value = [for s in google_secret_manager_secret.s : s.secret_id] }
```

- [ ] **Step 5: Tạo `infra/modules/cloud-run/variables.tf` + `main.tf` + `outputs.tf`**

`variables.tf`:
```hcl
variable "project_id"       { type = string }
variable "region"           { type = string }
variable "image"            { type = string }
variable "service_account"  { type = string }
variable "secret_env"       { type = map(string), default = {} } # ENV_NAME => secret_id
```
`main.tf`:
```hcl
resource "google_cloud_run_v2_service" "api" {
  name     = "gigaflow-api"
  project  = var.project_id
  location = var.region
  deletion_protection = false
  template {
    service_account = var.service_account
    scaling { min_instance_count = 0, max_instance_count = 5 }
    containers {
      image = var.image
      ports { container_port = 8080 }
      dynamic "env" {
        for_each = var.secret_env
        content {
          name = env.key
          value_source { secret_key_ref { secret = env.value, version = "latest" } }
        }
      }
      startup_probe { http_get { path = "/health/ready" }, initial_delay_seconds = 5, period_seconds = 5 }
      liveness_probe { http_get { path = "/health/live" } }
    }
  }
}

resource "google_cloud_run_v2_service_iam_member" "public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.api.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
```
`outputs.tf`:
```hcl
output "url" { value = google_cloud_run_v2_service.api.uri }
```

- [ ] **Step 6: Tạo `infra/envs/dev/main.tf` (nối module + SA + IAM)**

```hcl
provider "google" { project = var.project_id, region = var.region }

resource "google_service_account" "api" {
  project      = var.project_id
  account_id   = "gigaflow-api"
  display_name = "GigaFlow API runtime"
}

module "secrets" {
  source     = "../../modules/secrets"
  project_id = var.project_id
  secret_ids = ["mongodb-uri", "gemini-api-key", "openai-api-key"]
}

resource "google_project_iam_member" "sa_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.api.email}"
}

module "cloud_run" {
  source          = "../../modules/cloud-run"
  project_id      = var.project_id
  region          = var.region
  image           = var.image
  service_account = google_service_account.api.email
  secret_env = {
    MONGODB_URI    = "mongodb-uri"
    GEMINI_API_KEY = "gemini-api-key"
    OPENAI_API_KEY = "openai-api-key"
  }
  depends_on = [module.secrets, google_project_iam_member.sa_secret_accessor]
}

output "api_url" { value = module.cloud_run.url }
```

- [ ] **Step 7: Tạo `infra/envs/dev/terraform.tfvars.example`**

```hcl
project_id = "gigaflow-dev"
image      = "asia-southeast1-docker.pkg.dev/gigaflow-dev/gigaflow/api:latest"
```

- [ ] **Step 8: Bật API GCP cần thiết (một lần, thủ công)**

Run:
```bash
gcloud services enable run.googleapis.com secretmanager.googleapis.com \
  cloudtasks.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com \
  --project=gigaflow-dev
```
Expected: enabled.

- [ ] **Step 9: Nạp Atlas URI vào Secret Manager (thủ công — Atlas tạo tay)**

Run (thay bằng URI thật của cluster Atlas dev):
```bash
printf '%s' "mongodb+srv://USER:PASS@cluster.mongodb.net/gigaflow" | \
  gcloud secrets versions add mongodb-uri --data-file=- --project=gigaflow-dev
```
> Chạy sau Step 10 (secret phải tồn tại trước — hoặc tạo version sau `terraform apply`). Ghi chú thứ tự trong README infra.

- [ ] **Step 10: Validate + plan**

Run:
```bash
cd infra/envs/dev
cp terraform.tfvars.example terraform.tfvars   # sửa image thật
terraform init && terraform validate && terraform plan
```
Expected: `validate` OK; `plan` liệt kê SA + secrets + Cloud Run (chưa apply nếu chưa có image — có thể apply sau Task 5 đã push image).

- [ ] **Step 11: Commit**

```bash
git add infra
git commit -m "infra: add Terraform skeleton for Cloud Run, secrets, and service account"
```

---

### Task 7: Firebase Hosting + rewrite `/api/**` → Cloud Run

**Files:**
- Create: `firebase.json`, `.firebaserc`
- Create: `apps/web/index.html` (placeholder để có `public` deploy được)

**Interfaces:**
- Consumes: Cloud Run service `gigaflow-api` ở `asia-southeast1` (Task 6).
- Produces: Hosting phục vụ web tĩnh; `/api/**` proxy sang Cloud Run same-origin.

- [ ] **Step 1: Tạo placeholder web — `apps/web/index.html`**

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>GigaFlow</title></head>
  <body><h1>GigaFlow — coming soon</h1></body>
</html>
```

- [ ] **Step 2: Tạo `.firebaserc`**

```json
{ "projects": { "default": "gigaflow-dev" } }
```

- [ ] **Step 3: Tạo `firebase.json`**

```json
{
  "hosting": {
    "public": "apps/web/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/api/**",
        "run": { "serviceId": "gigaflow-api", "region": "asia-southeast1" }
      },
      { "source": "**", "destination": "/index.html" }
    ]
  }
}
```

> Ở E1 web chưa có bước build tạo `dist`. Để deploy thử: tạm copy `apps/web/index.html` vào `apps/web/dist/index.html` (mkdir dist). Bước build web thật thuộc epic E13.

- [ ] **Step 4: Deploy thử Hosting**

Run:
```bash
mkdir -p apps/web/dist && cp apps/web/index.html apps/web/dist/index.html
firebase deploy --only hosting --project gigaflow-dev
```
Expected: URL Hosting in ra.

- [ ] **Step 5: Verify rewrite same-origin**

Run: `curl -fs https://gigaflow-dev.web.app/api/health && echo`
Expected: JSON health từ Cloud Run (cần Cloud Run đã deploy ở Task 6). Nếu Cloud Run chưa deploy, ghi TODO và verify lại sau.

- [ ] **Step 6: Commit**

```bash
git add firebase.json .firebaserc apps/web/index.html
git commit -m "infra: add Firebase Hosting with /api rewrite to Cloud Run"
```

---

### Task 8: Cloud Tasks queues + internal OIDC auth (khung)

**Files:**
- Create: `infra/modules/cloud-tasks/{main.tf,variables.tf,outputs.tf}`
- Modify: `infra/envs/dev/main.tf` (nối module + IAM enqueue)
- Create: `apps/api/src/middleware/internal-auth.ts`
- Modify: `apps/api/src/app.ts` (mount route `/internal/tasks/ping` bảo vệ bởi internal-auth)
- Test: `apps/api/src/middleware/internal-auth.test.ts`

**Interfaces:**
- Consumes: SA `gigaflow-api` (Task 6), Cloud Run URL.
- Produces:
  - TF: 3 queue `workout-gen`, `meal-gen`, `inbody-ocr`; SA có `roles/cloudtasks.enqueuer`.
  - `internalAuth(): MiddlewareHandler` — kiểm tra header `X-CloudTasks-QueueName` (khung dev) hoặc OIDC ở prod; chặn nếu thiếu.

- [ ] **Step 1: Tạo `infra/modules/cloud-tasks/variables.tf` + `main.tf` + `outputs.tf`**

`variables.tf`:
```hcl
variable "project_id" { type = string }
variable "region"     { type = string }
variable "queues"     { type = list(string) }
```
`main.tf`:
```hcl
resource "google_cloud_tasks_queue" "q" {
  for_each = toset(var.queues)
  project  = var.project_id
  location = var.region
  name     = each.value
  retry_config { max_attempts = 5 }
}
```
`outputs.tf`:
```hcl
output "queue_names" { value = [for q in google_cloud_tasks_queue.q : q.name] }
```

- [ ] **Step 2: Nối vào `infra/envs/dev/main.tf`**

Thêm:
```hcl
module "cloud_tasks" {
  source     = "../../modules/cloud-tasks"
  project_id = var.project_id
  region     = var.region
  queues     = ["workout-gen", "meal-gen", "inbody-ocr"]
}

resource "google_project_iam_member" "sa_enqueuer" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.api.email}"
}
```

- [ ] **Step 3: Viết test thất bại — `apps/api/src/middleware/internal-auth.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { internalAuth } from './internal-auth';

function appWith(): Hono {
  const app = new Hono();
  app.use('/internal/*', internalAuth());
  app.get('/internal/tasks/ping', (c) => c.json({ success: true }));
  return app;
}

describe('internalAuth', () => {
  it('rejects request without Cloud Tasks marker', async () => {
    const res = await appWith().request('/internal/tasks/ping');
    expect(res.status).toBe(401);
  });
  it('allows request with Cloud Tasks queue header', async () => {
    const res = await appWith().request('/internal/tasks/ping', {
      headers: { 'X-CloudTasks-QueueName': 'workout-gen' },
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 4: Chạy test — xác nhận FAIL**

Run: `pnpm --filter @gigaflow/api test src/middleware/internal-auth.test.ts`
Expected: FAIL (`./internal-auth` chưa tồn tại).

- [ ] **Step 5: Tạo `apps/api/src/middleware/internal-auth.ts`**

```typescript
import type { MiddlewareHandler } from 'hono';

// E1 khung: chấp nhận request mang header Cloud Tasks; prod (E7) sẽ verify OIDC token.
export function internalAuth(): MiddlewareHandler {
  return async (c, next) => {
    const marker = c.req.header('X-CloudTasks-QueueName');
    if (!marker) {
      return c.json({ success: false, message: 'Forbidden' }, 401);
    }
    await next();
  };
}
```

- [ ] **Step 6: Mount route ping trong `apps/api/src/app.ts`**

Thêm vào `createApp()` trước `notFound`:
```typescript
import { internalAuth } from './middleware/internal-auth';
// ...
app.use('/internal/*', internalAuth());
app.get('/internal/tasks/ping', (c) => c.json({ success: true, data: { pong: true } }));
```

- [ ] **Step 7: Chạy test — xác nhận PASS**

Run: `pnpm --filter @gigaflow/api test`
Expected: PASS (health 3 + db 1 + internal-auth 2).

- [ ] **Step 8: Validate infra**

Run: `cd infra/envs/dev && terraform validate`
Expected: OK.

- [ ] **Step 9: Commit**

```bash
git add apps/api infra
git commit -m "feat(api): add internal task auth stub; infra: add Cloud Tasks queues"
```

---

### Task 9: CI/CD — Cloud Build (lint/test/build → deploy)

**Files:**
- Create: `cloudbuild.yaml`
- Create: `.github/workflows/ci.yaml` (PR gate chạy test — chạy nhanh không cần GCP)

**Interfaces:**
- Consumes: monorepo scripts (`pnpm test`, `pnpm build`), Dockerfile (Task 5), Artifact Registry, Cloud Run (Task 6), Firebase Hosting (Task 7).
- Produces: pipeline PR (test) + main (build image → push → deploy Cloud Run + Hosting).

- [ ] **Step 1: Tạo Artifact Registry repo (một lần, thủ công)**

Run:
```bash
gcloud artifacts repositories create gigaflow --repository-format=docker \
  --location=asia-southeast1 --project=gigaflow-dev
```
Expected: repo tạo thành công.

- [ ] **Step 2: Tạo `.github/workflows/ci.yaml` (PR gate)**

```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm build
      - run: pnpm test
```

- [ ] **Step 3: Tạo `cloudbuild.yaml` (main → deploy)**

```yaml
substitutions:
  _REGION: asia-southeast1
  _REPO: gigaflow
  _SERVICE: gigaflow-api
steps:
  - name: gcr.io/cloud-builders/docker
    args: ["build", "-t",
           "${_REGION}-docker.pkg.dev/$PROJECT_ID/${_REPO}/api:$SHORT_SHA",
           "-f", "apps/api/Dockerfile", "."]
  - name: gcr.io/cloud-builders/docker
    args: ["push", "${_REGION}-docker.pkg.dev/$PROJECT_ID/${_REPO}/api:$SHORT_SHA"]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: gcloud
    args: ["run", "deploy", "${_SERVICE}",
           "--image", "${_REGION}-docker.pkg.dev/$PROJECT_ID/${_REPO}/api:$SHORT_SHA",
           "--region", "${_REGION}", "--platform", "managed", "--quiet"]
  - name: gcr.io/google.com/cloudsdktool/cloud-sdk
    entrypoint: bash
    args: ["-c", "npm i -g firebase-tools && cd apps/web && echo 'build web (E13)' && cd ../.. && firebase deploy --only hosting --project $PROJECT_ID --non-interactive || true"]
images:
  - "${_REGION}-docker.pkg.dev/$PROJECT_ID/${_REPO}/api:$SHORT_SHA"
options:
  logging: CLOUD_LOGGING_ONLY
```

> Kết nối repo GitHub với Cloud Build trigger (branch `main`) qua console/`gcloud builds triggers create github` — ghi lệnh trong README infra. Firebase deploy trong Cloud Build cần token/SA có quyền Hosting.

- [ ] **Step 4: Verify CI local (mô phỏng job test)**

Run: `pnpm install --frozen-lockfile && pnpm build && pnpm test`
Expected: tất cả test PASS, build xanh.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yaml cloudbuild.yaml
git commit -m "ci: add PR test gate and Cloud Build deploy pipeline"
```

---

## Self-Review

**1. Spec coverage (Epic E1):**
- E1-S1 Monorepo → Task 1 ✅
- E1-S2 shared Zod → Task 2 ✅
- E1-S3 Hono + health → Task 3 ✅
- E1-S4 Mongo client → Task 4 ✅
- E1-S5 Dockerfile + Cloud Run → Task 5 (image) + Task 6 (Cloud Run TF) ✅
- E1-S6 Terraform skeleton → Task 6 ✅
- E1-S7 Firebase Hosting rewrite → Task 7 ✅
- E1-S8 CI/CD → Task 9 ✅
- E1-S9 Cloud Tasks queues → Task 8 ✅

**2. Placeholder scan:** không có TODO mơ hồ trong code steps; các bước infra thủ công (bucket, enable API, Atlas URI, GitHub trigger) là hành động vận hành có lệnh cụ thể, không phải placeholder. `apps/web` build thật hoãn sang E13 và được đánh dấu rõ.

**3. Type consistency:** `apiSuccess`/`ApiResponse` (Task 2) dùng nhất quán ở Task 3. `createApp` (Task 3) dùng ở Task 5/8. `connectDb/getDb/closeDb` (Task 4) dùng ở Task 5. `internalAuth` (Task 8) tên khớp test↔impl. Secret ids (`mongodb-uri`,`gemini-api-key`,`openai-api-key`) khớp giữa module secrets và cloud-run `secret_env`.

**Lưu ý thực thi:** thứ tự deploy hạ tầng có phụ thuộc chéo (image phải có trước `terraform apply` Cloud Run; Cloud Run phải có trước khi verify Hosting rewrite). Các bước verify đã ghi điều kiện; khi chạy subagent-driven, review giữa Task 6↔7 để đảm bảo thứ tự.
