# VrixoBase

> Open-source Backend-as-a-Service platform — self-host your entire backend.

## Quick Start

**Prerequisites:** Node.js 20+, Docker (optional — backend runs on host if Docker unavailable)

```bash
# 1. Clone
git clone https://github.com/your-org/vrixobase.git
cd vrixobase

# 2. One-command setup (install, configure, migrate, seed, verify)
npm run setup

# 3. Start development
npm run dev
```

**That's it.** The API is at `http://localhost:4000/api` and Swagger docs at `http://localhost:4000/api/docs`.

---

## Prerequisites

| Requirement | Version | Check |
|---|---|---|
| Node.js | >= 20.0.0 | `node --version` |
| npm | >= 10.0 | `npm --version` |
| Docker (optional) | >= 24.0 | `docker --version` |

If Docker is not available, ensure PostgreSQL, Redis, and MinIO are running locally and configured in `.env`.

---

## Services

| Service | Default URL | Description |
|---|---|---|
| **API** | http://localhost:4000/api | NestJS backend |
| **Swagger UI** | http://localhost:4000/api/docs | Interactive API docs |
| **Frontend** | http://localhost:3000 | Next.js dashboard |
| **PostgreSQL** | localhost:5432 (or 5433 with Docker) | Database (via Prisma) |
| **Redis** | localhost:6379 | Cache + pub/sub |
| **MinIO** | localhost:9000 (API) / 9001 (Console) | S3-compatible storage |
| **Prisma Studio** | `npm run prisma:studio` | DB GUI |

---

## Commands

```bash
npm run setup          # Full project setup (install, configure, migrate, seed, verify)
npm run setup --check  # Validate environment only

npm run dev            # Start backend + frontend concurrently
npm run build          # Build all workspaces
npm run lint           # Lint all workspaces
npm run test           # Run unit tests
npm run test:e2e       # Run end-to-end tests

npm run docker:up      # Start Docker services (PostgreSQL, Redis, MinIO)
npm run docker:down    # Stop Docker services

npm run prisma:studio  # Open Prisma database GUI
npm run prisma:push    # Push schema to database

# ── Certification & Release Engineering ──
npm run certify        # Full production certification (all checks below, plus release-report.json)
npm run smoke          # Production smoke tests (16 endpoints, payload-validated)
npm run release:report # Generate release-report.json (git, version, health, deps)
npm run rollback:check # Verify rollback readiness (migrations, build, env)
npm run startup:timing # Measure cold start & connection latencies
npm run memory:baseline# Memory baseline (RSS, heap, CPU, handles)
npm run dep:audit      # Dependency audit (duplicates, vulns, circular, orphans)
```

---

## Environment Variables

The `.env` file is auto-created from `.env.example` during `npm run setup`.

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | yes | — | PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | yes | (auto-generated) | JWT signing key (min 16 chars) |
| `JWT_REFRESH_SECRET` | yes | (auto-generated) | Refresh token key |
| `ENCRYPTION_KEY` | yes | (auto-generated) | Encryption key (min 16 chars) |
| `ENCRYPTION_SALT` | yes | (auto-generated) | Encryption salt |
| `SESSION_SECRET` | yes | (auto-generated) | Session secret |
| `MINIO_ACCESS_KEY` | yes | `vrixo_admin` | MinIO access key |
| `MINIO_SECRET_KEY` | yes | `vrixo_minio_secret` | MinIO secret key |
| `REDIS_HOST` | no | `localhost` | Redis host |
| `REDIS_PORT` | no | `6379` | Redis port |
| `CORS_ORIGINS` | no | `http://localhost:3000` | Allowed CORS origins |

If any required variable is missing, the application will print exactly which one is missing and terminate gracefully at startup.

---

## Project Structure

```
vrixobase/
├── backend/                 # NestJS API
│   ├── prisma/              # Schema, migrations, seed
│   ├── src/
│   │   ├── common/          # Shared filters, interceptors, decorators
│   │   ├── modules/         # Feature modules (auth, database, storage, etc.)
│   │   ├── app.module.ts    # Root module
│   │   ├── main.ts          # Entry point (env validation runs first)
│   │   └── env.validator.ts # Startup environment validation
│   └── Dockerfile
├── frontend/                # Next.js dashboard
├── e2e/                     # Playwright end-to-end tests
├── packages/                # Shared packages
├── scripts/                 # Setup, backup, restore utilities
├── infra/                   # Kubernetes, Nginx, monitoring config
├── docker-compose.yml       # Local development services
└── .env.example             # Environment template
```

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Frontend   │────▶│     Backend      │────▶│  PostgreSQL  │
│  Next.js    │     │   NestJS API      │     │  (via Prisma)│
│             │     │   + Socket.IO     │     └──────────────┘
└─────────────┘     │   + Prometheus    │     ┌──────────────┐
                    └────────┬─────────┘────▶│    Redis     │
                             │               │  (ioredis)   │
                             │               └──────────────┘
                             │               ┌──────────────┐
                             └──────────────▶│    MinIO     │
                                              │  (S3 API)    │
                                              └──────────────┘
```

---

## Node.js Backend

### How to run manually (without Docker)

```bash
# 1. Start infrastructure
docker compose up -d postgres redis minio

# 2. Setup
npm run setup

# 3. Start backend in watch mode
npm run dev -w backend
```

### Startup sequence

1. **Environment validation** — `env.validator.ts` checks all required variables. Missing vars are printed with explanations before the app exits.
2. **Database connection** — Prisma connects to PostgreSQL using `DATABASE_URL`.
3. **Redis** — ioredis connects for caching and pub/sub.
4. **MinIO** — S3-compatible storage client connects.
5. **WebSocket** — Socket.IO gateway starts for realtime subscriptions.
6. **Swagger** — OpenAPI docs generated at `/api/docs`.
7. **Metrics** — Prometheus endpoint at `/api/metrics`.

### Health endpoints

| Endpoint | Description |
|---|---|
| `GET /api/health` | Full dependency health (PostgreSQL, Redis, MinIO, Storage, Realtime, AI) |
| `GET /api/health/simple` | Lightweight health (no dependency calls) |
| `GET /api/health/liveness` | K8s liveness probe |
| `GET /api/health/readiness` | K8s readiness probe |
| `GET /api/health/startup` | K8s startup probe |
| `GET /api/health/version` | Version info |
| `GET /api/metrics` | Prometheus metrics |

---

## Docker Compose

```bash
# Start all services in background
docker compose up -d

# View logs
docker compose logs -f backend

# Stop everything
docker compose down
```

When using Docker Compose, the backend container connects to `postgres`, `redis`, and `minio` containers automatically. The PostgreSQL port is mapped to `5433` to avoid conflicts with local PostgreSQL installations.

---

## Testing

```bash
# Unit tests
npm run test -w backend

# E2E tests (requires running backend)
npm run test:e2e

# Lint
npm run lint

# Type check
npx tsc --noEmit -p backend/tsconfig.json
```

---

## Deployment & Certification

### Release Certification

Every deployment is automatically verified before considered successful:

```bash
npm run certify
```

This runs all certification modules and produces two artifacts:

| Artifact | Description |
|---|---|
| `production-certification-report.json` | Full certification: runtime, health, smoke tests, timing, memory, deps, rollback |
| `release-report.json` | Release manifest: git commit, version, build time, runtime verification, health + dependency summary |

### Certification Criteria

Deployment success means:

- ✅ Application started (liveness + readiness probes)
- ✅ All 6 dependencies healthy (database, redis, minio, storage, realtime, ai*)
- ✅ All 16 API endpoints operational (smoke-tested with payload validation)
- ✅ Metrics endpoint returning Prometheus data
- ✅ Database tables creatable and queryable
- ✅ Storage buckets creatable and listable
- ✅ Realtime subscriptions creatable
- ✅ Security policies and secrets operational
- ✅ Team members accessible
- ✅ Audit logs queryable

*`ai` dependency may report `degraded` if `OPENAI_API_KEY` is not configured — this is expected.

### Smoke Tests

```bash
npm run smoke           # 16 endpoints, 36 assertions, payload-validated
```

### Rollback Verification

```bash
npm run rollback:check  # Checks: git state, migration rollback, build backup, env preservation
```

### Startup Timing

```bash
npm run startup:timing  # Measures: backend cold start, DB, Redis, MinIO connection latencies
```

### Memory Baseline

```bash
npm run memory:baseline # Reports: RSS, heap total/used, CPU user/system, open handles
```

### Dependency Audit

```bash
npm run dep:audit # Checks: duplicates, vulnerabilities (high+), circular deps, orphan modules
```

### Release Report

```bash
npm run release:report  # Produces release-report.json (consumed by CI/CD pipelines)
```

---

## Vercel Deployment

VrixoBase frontend (Next.js) can be deployed to Vercel. The NestJS backend requires a separate hosting platform (see [Backend Hosting](#backend-hosting) below).

### One-Click Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyour-org%2Fvrixobase&root-directory=frontend&project-name=vrixobase&repository-name=vrixobase&env=NEXT_PUBLIC_API_URL,NEXT_PUBLIC_WS_URL,NEXT_PUBLIC_APP_URL)

### Manual Setup

1. **Push to GitHub** and import the repo into Vercel.

2. **Configure project in Vercel dashboard:**

   | Setting | Value |
   |---|---|
   | Root Directory | `frontend` |
   | Framework | Next.js |
   | Build Command | `npm run vercel-build` |
   | Output Directory | `.next` (Next.js default) |

3. **Add environment variables** — copy from `frontend/.env.vercel` to Vercel project settings:

   | Variable | Example Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_API_URL` | `https://api.vrixobase.com` | Your deployed backend URL |
   | `NEXT_PUBLIC_WS_URL` | `wss://api.vrixobase.com` | WebSocket (same backend) |
   | `NEXT_PUBLIC_APP_URL` | `https://vrixobase.vercel.app` | Auto-set by Vercel |
   | `NEXT_PUBLIC_AUTH_GOOGLE_REDIRECT` | `https://vrixobase.vercel.app/auth/callback/google` | Update per env |
   | `NEXT_PUBLIC_AUTH_GITHUB_REDIRECT` | `https://vrixobase.vercel.app/auth/callback/github` | Update per env |
   | `NEXT_PUBLIC_STORAGE_URL` | `https://your-bucket.s3.amazonaws.com` | S3/MinIO endpoint |
   | `NEXT_PUBLIC_MINIO_ENDPOINT` | `your-bucket.s3.amazonaws.com` | S3/MinIO host |
   | `NEXT_PUBLIC_MINIO_USE_SSL` | `true` | `true` for cloud |

4. **Deploy** — Vercel automatically builds and deploys on every push to the default branch.

### Preview Deployments

Each pull request gets a unique preview URL. Environment variables can be overridden per branch in the Vercel dashboard.

### Backend Hosting

The NestJS backend **cannot run on Vercel serverless** (WebSocket + persistent connections). Deploy it separately:

| Platform | Notes |
|---|---|
| **Railway** | `railway.toml` included; `docker compose up` style |
| **Render** | Web Service from Dockerfile |
| **Fly.io** | `fly.toml` with `dockerfile: backend/Dockerfile` |
| **Kubernetes** | Manifests in `infra/k8s/` |
| **VPS (manual)** | Docker Compose via `infra/docker-compose.prod.yml` |

Then set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` to the deployed backend's URL.

---

## License

MIT
