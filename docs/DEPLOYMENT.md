# VrixoBase — Production Deployment Guide

## Prerequisites

- Docker 24+ with Compose v2
- Linux server (Ubuntu 22.04+ recommended)
- Domain name with DNS pointing to server
- SSL certificate (Let's Encrypt or custom)
- 4+ CPU cores, 8GB+ RAM, 50GB+ SSD

## Installation

### 1. Clone and Setup

```bash
git clone <repository> vrixobase
cd vrixobase

# Generate production secrets
openssl rand -base64 48 > .jwt_secret
openssl rand -base64 48 > .jwt_refresh_secret
openssl rand -hex 32 > .encryption_key

# Configure environment
cp .env.example .env
# Edit .env with your values
```

### 2. Configure SSL

Place SSL certificates in infra/nginx/ssl/:
- fullchain.pem
- privkey.pem

Or use Let's Encrypt:
```bash
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem infra/nginx/ssl/
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem infra/nginx/ssl/
```

### 3. Deploy

```bash
# Build and start all services
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d

# Run database migrations
docker compose exec backend npx prisma migrate deploy

# (Optional) Start monitoring stack
docker compose -f infra/docker-compose.monitoring.yml up -d
```

### 4. Verify Deployment

```bash
# Check all services
docker compose ps

# Run health checks
./scripts/health-check.sh

# Verify API
curl https://yourdomain.com/api/health/dependencies

# Access frontend
# https://yourdomain.com
```

### 5. Configure Backups

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * /opt/vrixobase/scripts/backup.sh --encrypt --encryption-key $(cat /opt/vrixobase/.encryption_key) --retention-days 30

# Verify backup works
./scripts/backup.sh --encrypt --encryption-key "$(cat .encryption_key)"
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | — | PostgreSQL connection string |
| REDIS_URL | Yes | — | Redis connection string |
| JWT_ACCESS_SECRET | Yes | — | JWT signing key (generate with: openssl rand -base64 48) |
| JWT_REFRESH_SECRET | Yes | — | JWT refresh key |
| MINIO_ACCESS_KEY | Yes | vrixo_admin | MinIO root user |
| MINIO_SECRET_KEY | Yes | — | MinIO root password |
| ENCRYPTION_KEY | Yes | — | App-level encryption (32-byte hex) |
| BACKUP_ENCRYPTION_KEY | Recommended | — | Backup encryption key |
| OPENAI_API_KEY | No | — | AI module API key |
| CORS_ORIGINS | Yes | http://localhost:3000 | Comma-separated allowed origins |

## Health Endpoints

| Endpoint | Purpose | Expected Status |
|----------|---------|-----------------|
| GET /api/health/liveness | Kubernetes liveness probe | 200: alive |
| GET /api/health/readiness | Kubernetes readiness probe | 200: ready (when DB connected) |
| GET /api/health/startup | Kubernetes startup probe | 200: started (after init) |
| GET /api/health | Simple check | 200: healthy |
| GET /api/health/dependencies | Full dependency check | 200: healthy or degraded |
| GET /api/health/version | Version info | 200: version details |

## Monitoring Stack (Optional)

```bash
# Start Prometheus + Grafana + exporters
docker compose -f infra/docker-compose.monitoring.yml up -d

# Grafana: http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## Updating

```bash
git pull
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml build
docker compose -f docker-compose.yml -f infra/docker-compose.prod.yml up -d
```

## Backup

```bash
# Manual backup
./scripts/backup.sh --encrypt --encryption-key "$(cat .encryption_key)"

# Restore from backup
./scripts/restore.sh /path/to/backup/20260626_120000

# Selective restore (table)
./scripts/restore.sh /path/to/backup --type table --table-name users

# Selective restore (project)
./scripts/restore.sh /path/to/backup --type project --project-id abc123
```

## Troubleshooting

### Backend won't start
```bash
docker compose logs backend --tail 50
# Check PostgreSQL is accepting connections
# Check .env file is properly configured
```

### Database connection refused
```bash
docker compose logs postgres --tail 20
docker exec postgres pg_isready -U vrixo -d vrixo
```

### Health check fails
```bash
curl http://localhost:4000/api/health/dependencies
./scripts/health-check.sh
```
