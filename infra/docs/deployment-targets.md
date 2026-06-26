# Deployment Targets

## 1. Kubernetes (Primary - Production)

**Environment**: Production, Staging
**Orchestration**: K8s manifests in `infra/k8s/` (Kustomize)
**CI/CD**: GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/cd.yml`)

### Components
| Component | Replicas | Resources (req/lim) | Port |
|-----------|----------|---------------------|------|
| Backend   | 3 (HPA: 2-10) | 250m/1 CPU, 256Mi/512Mi | 4000 |
| Frontend  | 2 (HPA: 2-6)  | 125m/500m CPU, 256Mi/512Mi | 3000 |

### Stateful Dependencies (External to K8s)
- PostgreSQL 16 (RDS or CloudNativePG Operator)
- Redis 7 (ElastiCache or Redis Operator)
- MinIO (standalone deployment or MinIO Operator)

### Required Secrets
- `vrixo-secrets`: JWT secrets, API keys, service credentials
- `vrixo-db-secret`: DATABASE_URL, Redis password
- `vrixo-tls`: TLS certificate (managed by cert-manager)

---

## 2. Docker Compose (Secondary - Development/Staging)

**Environment**: Development, Staging, Single-server Production
**Compose file**: `infra/docker-compose.prod.yml`
**Monitoring**: `infra/docker-compose.monitoring.yml`

### Services
| Service | Image | Replicas |
|---------|-------|----------|
| PostgreSQL 16 | postgres:16-alpine | 1 |
| Redis 7 | redis:7-alpine | 1 |
| MinIO | minio/minio:latest | 1 |
| Backend | ghcr.io/vrixo/vrixo-base/backend:latest | 2 |
| Frontend | ghcr.io/vrixo/vrixo-base/frontend:latest | 1 |
| Nginx | nginx:alpine | 1 |

### Network Architecture
- Internal network (`vrixo-internal`): backend, postgres, redis, minio
- Public network (`vrixo-public`): nginx, backend, frontend

---

## 3. Serverless / Edge (Future)

### Candidates
- **Backend API**: Consider splitting stateless endpoints to Cloudflare Workers / AWS Lambda
- **File processing**: Use Cloudflare R2 + Workers for thumbnail generation
- **Realtime**: Consider using Cloudflare Durable Objects for WebSocket scaling

### Requirements
- Stateless function handlers
- JWT verification at edge
- Database connection pooling via PgBouncer
- Redis via Upstash or similar

---

## Prerequisites (All Targets)

### Environment Variables
Required variables (configure in CI/CD secrets):
```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_ACCESS_SECRET=<random-64-char>
JWT_REFRESH_SECRET=<random-64-char>
MINIO_ACCESS_KEY=<minio-access-key>
MINIO_SECRET_KEY=<minio-secret-key>
ENCRYPTION_KEY=<aes-256-key>
BACKUP_ENCRYPTION_KEY=<backup-enc-key>
```

### Infrastructure Prerequisites
- Docker registry access (GHCR)
- DNS records configured (vrixobase.com, staging.vrixobase.com)
- TLS certificates (Let's Encrypt via cert-manager or manual)
- Object storage bucket (MinIO or S3-compatible)
- Monitoring stack (Prometheus + Grafana) per `infra/monitoring/`
- Backup infrastructure per `infra/ops/backup/`
