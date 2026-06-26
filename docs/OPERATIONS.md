# VrixoBase — Operations Guide

## Table of Contents
1. Production Architecture
2. Service Descriptions
3. Health System
4. Monitoring & Alerting
5. Backup & Recovery
6. Disaster Recovery
7. Incident Response
8. Maintenance Procedures
9. Scaling
10. Security

## 1. Production Architecture

- **Docker Compose** with 6 services: postgres, redis, minio, backend (2 replicas), frontend, nginx
- **Networks**: vrixo-internal (private), vrixo-public (public-facing)
- **Volumes**: pgdata, redisdata, miniodata, backend_uploads
- **Monitoring stack**: Prometheus + Grafana (optional)

## 2. Service Descriptions

- **PostgreSQL 16**: Primary database. Port 5432. WAL archiving enabled for PITR.
- **Redis 7**: Cache, pub/sub for realtime. AOF + RDB persistence. Port 6379.
- **MinIO**: S3-compatible storage for file uploads. Ports 9000 (API), 9001 (Console).
- **Backend**: NestJS API server. Port 4000. Scaled to 2 replicas. Health endpoints at /api/health/*.
- **Frontend**: Next.js 16. Port 3000. Server-side rendering.
- **Nginx**: Reverse proxy, SSL termination, rate limiting. Ports 80, 443.

## 3. Health System

| Endpoint | Type | Purpose | Expected Response |
|----------|------|---------|-------------------|
| GET /api/health/liveness | Liveness | Is process alive | {"data":{"status":"alive"}} |
| GET /api/health/readiness | Readiness | Can accept traffic | {"data":{"status":"ready","database":"healthy"}} |
| GET /api/health/startup | Startup | Has initialized | {"data":{"status":"started"}} |
| GET /api/health | Simple | Basic health | {"data":{"status":"healthy","uptime":N}} |
| GET /api/health/dependencies | Dependencies | All service health | {"data":{"status":"healthy","checks":{...}}} |

The dependencies endpoint checks: database, redis, minio, storage, realtime, ai

## 4. Monitoring & Alerting

- Prometheus scrapes backend at /api/metrics (if configured), node-exporter, postgres-exporter
- Grafana dashboards at port 3001
- Key metrics to monitor:
  - Request rate, latency (P50/P95/P99), error rate
  - Database connection pool usage
  - Redis memory and hit rate
  - Container resource usage

## 5. Backup & Recovery

### Automated Backup
```
# PowerShell
.\scripts\backup.ps1 -Encrypt -EncryptionKey "your-key"

# Bash
./scripts/backup.sh --encrypt --encryption-key "your-key"
```

### Backup Types
- Full: All services (PostgreSQL custom format dump, Redis RDB+AOF, MinIO tar.gz)
- Encryption: AES-256-CBC with PBKDF2
- Verification: SHA-256 checksums automatically generated and verified
- Retention: Configurable (default 30 days)
- Schedule: Via cron / Task Scheduler

### Restore
```
# Full restore
.\scripts\restore.ps1 .\backups\20260626_120000

# Table-level restore
.\scripts\restore.ps1 .\backups\20260626_120000 --type table --table-name users

# Project-level restore
.\scripts\restore.ps1 .\backups\20260626_120000 --type project --project-id proj_abc123
```

## 6. Disaster Recovery

### Recovery Objectives
- RTO: 30 minutes (full system restore)
- RPO: 5 minutes (WAL archiving) / 1 hour (without WAL)

### Recovery Scenarios

**PostgreSQL Crash**:
1. Docker auto-restarts (restart: always)
2. Backend detects DB health via readiness probe
3. Backend retries connection automatically
4. Verify with: ./scripts/health-check.ps1

**Full Server Loss**:
1. Provision new server with Docker
2. Run: ./scripts/setup.sh --prod
3. Restore latest backup: ./scripts/restore.sh <latest_backup>
4. If WAL archiving enabled: replay WAL for PITR
5. Verify all health endpoints

### Disaster Recovery Checklist
- [ ] Latest backups verified with sha256sum
- [ ] Backups encrypted and stored off-site
- [ ] WAL archiving enabled and tested
- [ ] Redis AOF persistence enabled
- [ ] MinIO backup verified
- [ ] Restore procedure tested (quarterly)
- [ ] Health endpoints all returning healthy
- [ ] Monitoring dashboards accessible
- [ ] Incident response contacts current

## 7. Incident Response

### Severity Levels
- **SEV1**: Complete system outage — all users affected
- **SEV2**: Partial outage — degraded performance, some features unavailable
- **SEV3**: Minor issue — no user impact, needs investigation

### Response Steps

**SEV1 - Full Outage**:
1. Check service status: docker ps
2. Check logs: ./scripts/maintenance.sh logs
3. Restart services: ./scripts/maintenance.sh restart
4. If database issue: restore from latest backup
5. If hardware issue: provision new server
6. Verify recovery: ./scripts/health-check.ps1

**SEV2 - Degraded**:
1. Run health check: ./scripts/health-check.ps1
2. Check individual services: docker logs <service>
3. Restart affected service
4. Run database maintenance: ./scripts/maintenance.sh vacuum

**SEV3 - Investigation**:
1. Check logs for error patterns
2. Run diagnostics
3. Document findings

## 8. Maintenance Procedures

### Routine Maintenance (Weekly)
```bash
./scripts/maintenance.sh vacuum        # PostgreSQL VACUUM ANALYZE
./scripts/maintenance.sh prune         # Clean Docker resources
./scripts/maintenance.sh ping          # Verify all services
```

### Monthly Maintenance
```bash
./scripts/maintenance.sh reindex       # PostgreSQL REINDEX
./scripts/backup.sh --encrypt          # Full backup
```

### Quarterly Maintenance
- Test full restore procedure
- Review backup retention and storage
- Update incident response plan
- Review and rotate secrets

## 9. Scaling

### Horizontal Scaling
- Backend: Increase replicas in docker-compose.prod.yml
- Frontend: Stateless, can scale horizontally behind nginx
- Database: Add read replicas for query offloading

### Vertical Scaling
- PostgreSQL: Increase CPU/memory limits
- Redis: Increase memory for larger cache
- MinIO: Increase storage volume size

### Performance Limits (Certified)
- 250 concurrent users (authenticated API calls)
- 539 req/s throughput
- 450ms avg latency
- 0% failure rate
- P99 under 1 second

## 10. Security

### Secrets Management
- JWT secrets: Generated during setup, stored in .env
- Database credentials: vrixo/vrixo_secret (change in production)
- MinIO credentials: vrixo_admin/vrixo_minio_secret (change in production)
- Encryption key: BACKUP_ENCRYPTION_KEY env var
- OpenAI key: OPENAI_API_KEY env var

### Network Security
- vrixo-internal: Internal bridge, no external access
- vrixo-public: Public-facing services only
- nginx handles SSL termination and rate limiting
- Security headers: CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- CORS restricted to configured origins

### Container Security
- Non-root users (vrixo:1001, nextjs:1001)
- Read-only root filesystem where possible
- Resource limits prevent DoS
- Health checks prevent routing to unhealthy instances
