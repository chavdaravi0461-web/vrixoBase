# VrixoBase

> Open-source Supabase Alternative — Self-host your entire backend platform.

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker)](https://docker.com)
[![Node.js](https://img.shields.io/badge/node-20%2B-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5%2B-3178C6?logo=typescript)](https://typescriptlang.org)
[![NestJS](https://img.shields.io/badge/nestjs-10%2B-E0234E?logo=nestjs)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/next.js-16-000000?logo=next.js)](https://nextjs.org)
[![Prisma](https://img.shields.io/badge/prisma-5-2D3748?logo=prisma)](https://prisma.io)

---

## Features

| # | Area | Description |
|---|------|-------------|
| 1 | **Authentication** | Email/password, OAuth (Google, GitHub), JWT, refresh tokens, MFA, password reset |
| 2 | **Database** | Full PostgreSQL management — create tables, columns, indexes, execute queries, schema visualization |
| 3 | **Auto API Proxy** | RESTful endpoints auto-generated from your database tables |
| 4 | **Storage** | S3-compatible file storage via MinIO — buckets, signed URLs, public/private files |
| 5 | **Realtime** | WebSocket-based subscriptions, presence, and broadcast via Socket.IO |
| 6 | **Edge Functions** | Serverless function execution (Node.js, Python, Go), webhook triggers |
| 7 | **Monitoring** | Metrics, logging, Prometheus + Grafana integration |
| 8 | **Dashboard** | Next.js admin UI — manage projects, tables, storage, functions, settings |
| 9 | **Security** | Row-Level Security (RLS), API keys, secrets management, CORS, rate limiting |
| 10 | **Team Collaboration** | Project members, roles, invitations, audit logging |

---

## Quick Start

```bash
# Clone the repository
git clone https://github.com/your-org/vrixobase.git
cd vrixobase

# Set up environment and start everything
./scripts/setup.sh --dev
```

Or manually:

```bash
# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d
```

Once running:

| Service | URL |
|---------|-----|
| Dashboard | http://localhost:3000 |
| API | http://localhost:4000 |
| API Docs (Swagger) | http://localhost:4000/api/docs |
| MinIO Console | http://localhost:9001 |
| PostgreSQL | `localhost:5432` |
| Redis | `localhost:6379` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         Nginx                            │
│              Reverse Proxy / SSL / Rate Limiter          │
└──────┬──────────────────────┬────────────────────┬───────┘
       │                      │                    │
       ▼                      ▼                    ▼
┌──────────────┐    ┌──────────────────┐  ┌──────────────┐
│   Frontend   │    │     Backend      │  │   Storage    │
│  Next.js 16  │    │   NestJS 10 API  │  │   MinIO      │
│  React 19    │◄──►│   Socket.IO      │  │   S3 API     │
│  Tailwind 4  │    │   Prisma ORM     │  │              │
└──────────────┘    └────────┬─────────┘  └──────────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
       ┌──────────┐  ┌──────────┐  ┌──────────────┐
       │PostgreSQL│  │  Redis   │  │   Prometheus │
       │   16     │  │    7     │  │   + Grafana  │
       └──────────┘  └──────────┘  └──────────────┘
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript 5, Express |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 |
| **Database** | PostgreSQL 16 (via Prisma ORM) |
| **Cache** | Redis 7 (via ioredis) |
| **Storage** | MinIO (S3-compatible) |
| **Realtime** | Socket.IO, WebSocket |
| **Auth** | Passport.js, JWT, bcryptjs |
| **API** | RESTful, Swagger/OpenAPI |
| **Monitoring** | Prometheus, Grafana, node-exporter |
| **Proxy** | Nginx (SSL, rate limiting, caching) |
| **Runtime** | Node.js 20+, Docker, Docker Compose |

---

## Project Structure

```
vrixobase/
├── backend/                  # NestJS API server
│   ├── prisma/               # Schema & migrations
│   ├── src/
│   │   ├── modules/          # Feature modules
│   │   │   ├── auth/         # Auth controller, service, guards, strategies
│   │   │   ├── database/     # Table management, SQL queries
│   │   │   ├── storage/      # File buckets & uploads
│   │   │   ├── realtime/     # WebSocket gateway + subscriptions
│   │   │   ├── functions/    # Serverless edge functions
│   │   │   ├── monitoring/   # Metrics & health data
│   │   │   ├── security/     # RLS policies, secrets
│   │   │   ├── team/         # Members & invitations
│   │   │   ├── audit/        # Audit logs
│   │   │   ├── project/      # Project CRUD
│   │   │   └── health/       # Health check endpoint
│   │   ├── common/           # Shared decorators, filters, interceptors
│   │   ├── app.module.ts     # Root module
│   │   └── main.ts           # Entry point
│   └── Dockerfile
├── frontend/                 # Next.js dashboard
│   ├── src/
│   │   ├── app/              # Pages & layouts
│   │   ├── components/       # Reusable UI components
│   │   ├── hooks/            # React hooks (useAuth, useDatabase, etc.)
│   │   ├── lib/              # API client & SDK
│   │   ├── stores/           # Zustand state stores
│   │   └── types/            # TypeScript definitions
│   └── Dockerfile
├── infra/                    # Infrastructure config
│   ├── nginx/                # Nginx config (SSL, proxy, caching)
│   ├── monitoring/           # Prometheus & Grafana config
│   ├── docker-compose.prod.yml
│   └── docker-compose.monitoring.yml
├── scripts/
│   ├── setup.sh              # One-command setup
│   ├── backup.sh             # Database + storage backup
│   └── restore.sh            # Restore from backup
├── docker-compose.yml        # Main compose file
├── .env.example              # Environment variables template
└── README.md
```

---

## Environment Setup

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Key variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://vrixo:vrixo_secret@postgres:5432/vrixo` |
| `REDIS_URL` | Redis connection | `redis://redis:6379` |
| `JWT_SECRET` | JWT signing secret | (generate with `openssl rand -base64 48`) |
| `JWT_REFRESH_SECRET` | Refresh token secret | (generate with `openssl rand -base64 48`) |
| `MINIO_ACCESS_KEY` | MinIO access key | `vrixo_admin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `vrixo_minio_secret` |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | (optional) |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID | (optional) |

---

## Development

```bash
# Backend (watch mode)
cd backend
npm install
npm run start:dev

# Frontend (watch mode)
cd frontend
npm install
npm run dev

# Prisma Studio (DB GUI)
cd backend
npm run prisma:studio

# Run tests
cd backend
npm run test
npm run test:e2e

# Lint
cd backend && npm run lint
cd frontend && npm run lint
```

---

## Deployment

### Docker (recommended)

```bash
# Production
docker-compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d

# With monitoring
docker-compose -f docker-compose.yml -f infra/docker-compose.prod.yml -f infra/docker-compose.monitoring.yml up -d
```

### Bare Metal

1. Install PostgreSQL 16, Redis 7, MinIO, Node.js 20+
2. Configure `.env` with service endpoints
3. Run database migrations:
   ```bash
   cd backend
   npx prisma generate
   npx prisma migrate deploy
   ```
4. Build and start backend: `npm run build && npm run start:prod`
5. Build and start frontend: `cd frontend && npm run build && npm start`

### SSL (Let's Encrypt)

```bash
# Install certbot, obtain certificates
certbot certonly --standalone -d yourdomain.com

# Mount certs in nginx container
# Place in ./infra/nginx/ssl/ and update default.conf
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for full deployment guide.

---

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/amazing`)
3. Commit changes (conventional commits)
4. Push and open a Pull Request

See [CONTRIBUTING.md](docs/CONTRIBUTING.md) for detailed guidelines.

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API.md) | Complete API endpoint documentation |
| [Deployment Guide](docs/DEPLOYMENT.md) | Production deployment instructions |
| [Architecture](docs/ARCHITECTURE.md) | System design and data flow |
| [Security](docs/SECURITY.md) | Security checklist and best practices |
| [SDK Reference](docs/SDK.md) | Client SDK (JS/TS) documentation |
| [Roadmap](docs/ROADMAP.md) | Development roadmap and changelog |
| [Contributing](docs/CONTRIBUTING.md) | How to contribute |
