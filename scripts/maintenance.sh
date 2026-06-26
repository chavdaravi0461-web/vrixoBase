#!/usr/bin/env bash
set -euo pipefail

# VrixoBase - Maintenance Script
# Usage: ./scripts/maintenance.sh [command]

COMMAND="${1:-status}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info() { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

get_container() {
    local filter="$1"
    docker ps --filter "name=${filter}" --format "{{.Names}}" | head -1
}

show_status() {
    log_info "System Status:"
    docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null
    echo ""
    log_info "Resource Usage:"
    docker stats --no-stream 2>/dev/null
    echo ""
    log_info "Disk Usage:"
    docker system df 2>/dev/null
}

show_logs() {
    local tail="${2:-50}"
    for container in $(docker ps --format "{{.Names}}" 2>/dev/null); do
        log_info "Last ${tail} lines for ${container}:"
        docker logs --tail "${tail}" "${container}" 2>&1
        echo ""
    done
}

do_prune() {
    log_info "Pruning Docker system..."
    docker system prune -f 2>/dev/null
    docker volume prune -f 2>/dev/null
    log_info "Prune complete"
}

do_restart() {
    log_info "Restarting all VrixoBase services..."
    local compose_file
    compose_file="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/docker-compose.yml"
    if [ -f "$compose_file" ]; then
        docker compose -f "$compose_file" restart 2>/dev/null
        log_info "Services restarted"
    else
        log_error "docker-compose.yml not found"
    fi
}

do_vacuum() {
    log_info "Running PostgreSQL VACUUM ANALYZE..."
    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    if [ -n "$container" ]; then
        docker exec "$container" psql --username=vrixo --dbname=vrixo -c "VACUUM ANALYZE;" 2>/dev/null
        log_info "VACUUM ANALYZE complete"
    else
        log_error "PostgreSQL container not found"
    fi
}

do_reindex() {
    log_info "Running PostgreSQL REINDEX..."
    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    if [ -n "$container" ]; then
        docker exec "$container" psql --username=vrixo --dbname=vrixo -c "REINDEX DATABASE vrixo;" 2>/dev/null
        log_info "REINDEX complete"
    else
        log_error "PostgreSQL container not found"
    fi
}

do_ping() {
    log_info "Connectivity tests..."
    for target in "Backend:http://localhost:4000/api/health" "Frontend:http://localhost:3000" "MinIO:http://localhost:9000/minio/health/live" "Nginx:http://localhost/health"; do
        local name="${target%%:*}" url="${target##*:}"
        if curl -sf -o /dev/null "$url" 2>/dev/null; then
            log_info "${name}: reachable"
        else
            log_error "${name}: unreachable"
        fi
    done
}

show_help() {
    echo "Usage: $0 [command]"
    echo "Commands:"
    echo "  status   - Show container status, resource usage, disk usage"
    echo "  logs     - Show last 50 lines of each container"
    echo "  prune    - Clean up unused Docker resources"
    echo "  restart  - Restart all VrixoBase services"
    echo "  vacuum   - Run PostgreSQL VACUUM ANALYZE"
    echo "  reindex  - Run PostgreSQL REINDEX DATABASE"
    echo "  ping     - Test connectivity to all services"
}

case "$COMMAND" in
    status) show_status ;;
    logs) show_logs ;;
    prune) do_prune ;;
    restart) do_restart ;;
    vacuum) do_vacuum ;;
    reindex) do_reindex ;;
    ping) do_ping ;;
    help|--help|-h) show_help ;;
    *) log_error "Unknown command: $COMMAND"; show_help; exit 1 ;;
esac
