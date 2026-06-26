# VrixoBase — Disaster Recovery Runbook

## Quick Reference
- **RTO**: 30 minutes
- **RPO**: 5 minutes (WAL) / 1 hour (without WAL)
- **Backup Location**: ./backups/YYYYMMDD_HHMMSS/
- **Recovery Script**: ./scripts/restore.sh / ./scripts/restore.ps1

## Recovery Scenarios

### 1. PostgreSQL Crash

**Symptoms**:
- Backend health shows database: unhealthy
- Readiness probe fails
- API returns 500 errors

**Steps**:
1. Check PostgreSQL status:
   ```
   docker ps | grep postgres
   docker logs <postgres_container> --tail 50
   ```
2. If container crashed, Docker will auto-restart
3. If auto-restart fails:
   ```
   docker compose restart postgres
   ```
4. Verify recovery:
   ```
   docker exec <postgres_container> pg_isready -U vrixo -d vrixo
   ./scripts/health-check.ps1
   ```

### 2. Redis Crash

**Steps**:
1. Check Redis status: `docker ps | grep redis`
2. Docker auto-restarts. On restart, Redis loads:
   - dump.rdb (RDB persistence)
   - appendonly.aof (if AOF enabled)
3. Backend reconnects automatically via retry strategy
4. Verify: `docker exec <redis_container> redis-cli PING`

### 3. MinIO Crash

**Steps**:
1. Docker auto-restarts
2. Data persists in miniodata volume
3. Verify: `curl http://localhost:9000/minio/health/live`

### 4. Backend Crash

**Symptoms**: Health endpoints return errors, frontend shows API errors

**Steps**:
1. Docker auto-restarts (restart: always)
2. In production with replicas=2, the other replica serves traffic
3. Health check determines when to route traffic
4. Verify: `GET /api/health/liveness`

### 5. Complete System Outage

**Prerequisites**: Latest backup available, Docker installed

**Recovery Steps**:
1. Start infrastructure:
   ```
   docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d postgres redis minio
   ```
2. Wait for database readiness:
   ```
   ./scripts/health-check.ps1  # Check postgres is accepting connections
   ```
3. Restore database:
   ```
   ./scripts/restore.sh /path/to/backup/20260626_120000
   ```
4. Start backend and frontend:
   ```
   docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d backend frontend nginx
   ```
5. Verify full recovery:
   ```
   ./scripts/health-check.ps1 --watch
   ```

### 6. Data Corruption

**Steps**:
1. Identify the corruption scope
2. For full corruption: restore from latest good backup
3. For table-level corruption: use selective restore
   ```
   ./scripts/restore.sh /backup/dir --type table --table-name <table_name>
   ```
4. For project-level corruption:
   ```
   ./scripts/restore.sh /backup/dir --type project --project-id <project_id>
   ```
5. Verify data integrity after restore

### 7. Network Outage

**Steps**:
1. Check DNS resolution
2. Check firewall / security groups
3. Verify Nginx is running: `docker ps | grep nginx`
4. Check SSL certificates
5. Verify backend API reachable internally

## Point-in-Time Recovery (PITR)

### Prerequisites
- WAL archiving must be enabled (configured in docker-compose.prod.yml)
- WAL archives available in pgdata/wal_archive/

### PITR Recovery Steps
1. Stop the database:
   ```
   docker compose stop postgres
   ```
2. Restore base backup:
   ```
   docker run --rm -v pgdata:/var/lib/postgresql/data postgres:16-alpine bash -c "cd /var/lib/postgresql/data && tar xzf /backup/postgres_data.tar.gz"
   ```
3. Configure recovery.conf:
   ```
   restore_command = 'cp /var/lib/postgresql/data/wal_archive/%f %p'
   recovery_target_time = '2026-06-26 12:00:00 UTC'
   ```
4. Start PostgreSQL (it will replay WAL)
   ```
   docker compose start postgres
   ```
5. Verify recovery target was reached:
   ```
   docker exec <postgres> psql -U vrixo -d vrixo -c "SELECT * FROM pg_last_wal_replay_lsn();"
   ```

## Backup Verification Procedure

### Manual Verification
```bash
# 1. Create test backup
./scripts/backup.sh --output-dir /tmp/test_backup

# 2. Verify checksums
cd /tmp/test_backup && sha256sum -c checksums.sha256

# 3. Restore to test database
docker exec <postgres> createdb vrixo_restore_test
docker exec <postgres> pg_restore -d vrixo_restore_test /tmp/restore_full.dump

# 4. Compare table counts
docker exec <postgres> psql -d vrixo -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
docker exec <postgres> psql -d vrixo_restore_test -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"

# 5. Clean up
docker exec <postgres> psql -c "DROP DATABASE vrixo_restore_test;"
```

## Recovery Verification Checklist

After any recovery operation, verify:
- [ ] PostgreSQL: pg_isready accepts connections
- [ ] PostgreSQL: Expected number of tables present
- [ ] Redis: PONG response
- [ ] MinIO: Health endpoint returns 200
- [ ] Backend: /api/health returns healthy
- [ ] Backend: /api/health/dependencies all pass
- [ ] Frontend: HTTP 200 on /
- [ ] Nginx: /health returns healthy
- [ ] Data: Test query returns expected results
- [ ] Auth: Login flow works
- [ ] Storage: File upload/download works
