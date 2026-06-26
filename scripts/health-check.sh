#!/usr/bin/env bash
set -euo pipefail

# VrixoBase - Comprehensive Health Check
# Usage: ./scripts/health-check.sh [--watch] [--interval 10]

WATCH=false
INTERVAL=10

while [[ $# -gt 0 ]]; do
    case "$1" in
        --watch) WATCH=true; shift ;;
        --interval) INTERVAL="$2"; shift 2 ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
pass() { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; }

get_container() {
    local filter="$1"
    docker ps --filter "name=${filter}" --format "{{.Names}}" | head -1
}

check_docker() {
    local total=0 healthy=0
    while IFS=$'\t' read -r name status; do
        total=$((total + 1))
        if echo "$status" | grep -qE "healthy|Up "; then
            healthy=$((healthy + 1))
        else
            fail "Container ${name}: ${status}"
        fi
    done < <(docker ps --format "{{.Names}}\t{{.Status}}" 2>/dev/null)
    if [ "$total" -eq "$healthy" ]; then
        pass "All containers healthy (${healthy}/${total})"
    else
        log_warn "${healthy}/${total} containers healthy"
    fi
}

check_api() {
    local endpoints=(
        "http://localhost:4000/api/health/liveness:alive"
        "http://localhost:4000/api/health/readiness:ready"
        "http://localhost:4000/api/health/startup:started"
        "http://localhost:4000/api/health:healthy"
        "http://localhost:4000/api/health/version:version"
    )
    for ep in "${endpoints[@]}"; do
        local url="${ep%%:*}" expect="${ep##*:}"
        if curl -sf "$url" 2>/dev/null | grep -q "$expect"; then
            pass "$(basename $url): OK"
        else
            fail "$(basename $url): check failed"
        fi
    done

    # Detailed dependency check
    if deps=$(curl -sf http://localhost:4000/api/health/dependencies 2>/dev/null); then
        echo "$deps" | python3 -c "
import sys, json
data = json.load(sys.stdin)
checks = data.get('data', {}).get('checks', {})
for name, info in checks.items():
    status = info.get('status', 'unknown')
    latency = info.get('latencyMs', 0)
    error = info.get('error', '')
    if status == 'healthy':
        print(f'  ✅ {name} ({latency}ms)')
    elif status == 'degraded':
        print(f'  ⚠️  {name}: DEGRADED ({error})')
    else:
        print(f'  ❌ {name}: {status} ({error})')
" 2>/dev/null
    else
        fail "Dependencies endpoint unreachable"
    fi
}

check_postgres() {
    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    if [ -n "$container" ]; then
        if docker exec "$container" pg_isready -U vrixo -d vrixo 2>/dev/null | grep -q "accepting connections"; then
            pass "PostgreSQL: accepting connections"
        else
            fail "PostgreSQL: not ready"
        fi
    else
        log_warn "PostgreSQL container not found"
    fi
}

check_redis() {
    local container
    container=$(get_container "vrixo.*redis") || container=$(get_container "redis")
    if [ -n "$container" ]; then
        if docker exec "$container" redis-cli PING 2>/dev/null | grep -q "PONG"; then
            pass "Redis: PONG"
        else
            fail "Redis: not responding"
        fi
    else
        log_warn "Redis container not found"
    fi
}

check_minio() {
    local container
    container=$(get_container "vrixo.*minio") || container=$(get_container "minio")
    if [ -n "$container" ]; then
        local status
        status=$(docker exec "$container" curl -sf -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live 2>/dev/null)
        if [ "$status" = "200" ]; then
            pass "MinIO: healthy"
        else
            fail "MinIO: HTTP $status"
        fi
    else
        log_warn "MinIO container not found"
    fi
}

check_frontend() {
    if curl -sf -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null | grep -q "200"; then
        pass "Frontend: OK"
    else
        log_warn "Frontend: not available"
    fi
}

check_nginx() {
    if curl -sf http://localhost/health 2>/dev/null | grep -q "healthy"; then
        pass "Nginx: OK"
    else
        log_warn "Nginx: not available"
    fi
}

main() {
    clear 2>/dev/null || true
    echo "========================================="
    echo "  VrixoBase - Health Check"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================="
    echo ""

    log_info "Docker Containers..."
    check_docker
    echo ""

    log_info "Backend API Health..."
    check_api
    echo ""

    log_info "PostgreSQL..."
    check_postgres
    echo ""

    log_info "Redis..."
    check_redis
    echo ""

    log_info "MinIO..."
    check_minio
    echo ""

    log_info "Frontend..."
    check_frontend
    echo ""

    log_info "Nginx..."
    check_nginx
}

main

if $WATCH; then
    while true; do
        sleep "$INTERVAL"
        main
    done
fi
