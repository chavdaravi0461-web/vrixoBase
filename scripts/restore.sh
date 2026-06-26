#!/usr/bin/env bash
set -euo pipefail

# VrixoBase - Enhanced Restore Script
# Usage: ./scripts/restore.sh <backup_directory> [--type full|table|project] [--project-id <id>] [--table-name <name>] [--decryption-key <key>] [--force]

BACKUP_DIR=""
TYPE="full"
PROJECT_ID=""
TABLE_NAME=""
DECRYPTION_KEY=""
FORCE=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --type) TYPE="$2"; shift 2 ;;
        --project-id) PROJECT_ID="$2"; shift 2 ;;
        --table-name) TABLE_NAME="$2"; shift 2 ;;
        --decryption-key) DECRYPTION_KEY="$2"; shift 2 ;;
        --force) FORCE=true; shift ;;
        --help|-h) echo "Usage: $0 <backup_dir> [--type full|table|project] [--project-id <id>] [--table-name <name>] [--decryption-key <key>] [--force]"; exit 0 ;;
        *) [ -z "$BACKUP_DIR" ] && BACKUP_DIR="$1" || { echo "Unknown: $1"; exit 1; }; shift ;;
    esac
done

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
pass() { echo -e "  ${GREEN}✅${NC} $1"; }
fail() { echo -e "  ${RED}❌${NC} $1"; }

get_container() {
    local filter="$1"
    docker ps --filter "name=${filter}" --format "{{.Names}}" | head -1
}

decrypt_backup() {
    local enc_files
    enc_files=$(find "${BACKUP_DIR}" -name "*.enc" 2>/dev/null)
    [ -z "${enc_files}" ] && return

    [ -z "${DECRYPTION_KEY}" ] && log_error "Encrypted backup but no decryption key" && exit 1

    log_info "Decrypting backup files..."
    cd "${BACKUP_DIR}"
    for f in *.enc; do
        [ ! -f "$f" ] && continue
        local dec_file="${f%.enc}"
        openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in "$f" -out "$dec_file" -pass "pass:${DECRYPTION_KEY}" 2>/dev/null
        if [ $? -eq 0 ]; then
            pass "Decrypted: ${f}"
        else
            fail "Decryption failed: ${f}"
        fi
    done
}

verify_integrity() {
    log_info "Verifying backup integrity..."
    cd "${BACKUP_DIR}"
    [ ! -f checksums.sha256 ] && log_warn "No checksums file found" && return

    if sha256sum -c checksums.sha256 --quiet 2>/dev/null; then
        pass "All checksums verified"
    else
        fail "Checksum verification FAILED!"
        exit 1
    fi
}

restore_full() {
    log_info "Performing FULL restore..."

    # PostgreSQL
    local dump_file="${BACKUP_DIR}/postgres_full.dump"
    if [ -f "$dump_file" ]; then
        local container
        container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
        [ -z "${container}" ] && log_error "PostgreSQL container not found" && exit 1

        log_info "  Restoring PostgreSQL..."
        docker cp "$dump_file" "${container}:/tmp/restore_full.dump"
        docker exec "${container}" psql --username=vrixo --dbname=vrixo -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
        docker exec "${container}" pg_restore --username=vrixo --dbname=vrixo --clean --if-exists --no-owner --no-privileges "/tmp/restore_full.dump" 2>/dev/null
        docker exec "${container}" rm -f "/tmp/restore_full.dump"
        pass "PostgreSQL restored"
    fi

    # Redis
    local rdb_file="${BACKUP_DIR}/redis.rdb"
    if [ -f "$rdb_file" ]; then
        local container
        container=$(get_container "vrixo.*redis") || container=$(get_container "redis")
        [ -z "${container}" ] && log_error "Redis container not found" && exit 1

        log_info "  Restoring Redis..."
        docker exec "${container}" redis-cli FLUSHALL 2>/dev/null || true
        docker cp "$rdb_file" "${container}:/data/dump.rdb"
        docker exec "${container}" redis-cli SHUTDOWN NOSAVE 2>/dev/null || true
        sleep 2
        docker restart "${container}" 2>/dev/null || true
        pass "Redis restored"
    fi

    # MinIO
    local minio_archive="${BACKUP_DIR}/minio.tar.gz"
    if [ -f "$minio_archive" ]; then
        local container
        container=$(get_container "vrixo.*minio") || container=$(get_container "minio")
        [ -z "${container}" ] && log_error "MinIO container not found" && exit 1

        log_info "  Restoring MinIO..."
        docker cp "$minio_archive" "${container}:/tmp/restore_minio.tar.gz"
        docker exec "${container}" rm -rf /data/*
        docker exec "${container}" tar xzf "/tmp/restore_minio.tar.gz" -C /data 2>/dev/null
        docker exec "${container}" rm -f "/tmp/restore_minio.tar.gz"
        docker restart "${container}" 2>/dev/null || true
        pass "MinIO restored"
    fi

    verify_recovery
}

restore_table() {
    [ -z "${TABLE_NAME}" ] && log_error "--table-name required for table-level restore" && exit 1
    local dump_file="${BACKUP_DIR}/postgres_full.dump"
    [ ! -f "$dump_file" ] && log_error "PostgreSQL dump not found" && exit 1

    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    [ -z "${container}" ] && log_error "PostgreSQL container not found" && exit 1

    log_info "Restoring table: ${TABLE_NAME}"
    docker cp "$dump_file" "${container}:/tmp/restore_table.dump"
    docker exec "${container}" pg_restore --username=vrixo --dbname=vrixo --clean --if-exists --no-owner --no-privileges -t "${TABLE_NAME}" "/tmp/restore_table.dump" 2>/dev/null
    docker exec "${container}" rm -f "/tmp/restore_table.dump"
    pass "Table '${TABLE_NAME}' restored"
}

restore_project() {
    [ -z "${PROJECT_ID}" ] && log_error "--project-id required for project-level restore" && exit 1
    local dump_file="${BACKUP_DIR}/postgres_full.dump"
    [ ! -f "$dump_file" ] && log_error "PostgreSQL dump not found" && exit 1

    local schema_name="proj_${PROJECT_ID}"
    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    [ -z "${container}" ] && log_error "PostgreSQL container not found" && exit 1

    log_info "Restoring schema: ${schema_name}"
    docker cp "$dump_file" "${container}:/tmp/restore_proj.dump"
    docker exec "${container}" psql --username=vrixo --dbname=vrixo -c "DROP SCHEMA IF EXISTS ${schema_name} CASCADE; CREATE SCHEMA ${schema_name};" 2>/dev/null
    docker exec "${container}" pg_restore --username=vrixo --dbname=vrixo --no-owner --no-privileges --schema="${schema_name}" "/tmp/restore_proj.dump" 2>/dev/null
    docker exec "${container}" rm -f "/tmp/restore_proj.dump"
    pass "Project '${PROJECT_ID}' restored"
}

verify_recovery() {
    log_info "Recovery verification..."
    local pg_container
    pg_container=$(get_container "vrixo.*postgres") || pg_container=$(get_container "postgres")
    if [ -n "${pg_container}" ]; then
        local table_count
        table_count=$(docker exec "${pg_container}" psql --username=vrixo --dbname=vrixo -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';" 2>/dev/null | tr -d ' ')
        pass "PostgreSQL: ${table_count} tables restored"
    fi

    local redis_container
    redis_container=$(get_container "vrixo.*redis") || redis_container=$(get_container "redis")
    if [ -n "${redis_container}" ]; then
        local ping
        ping=$(docker exec "${redis_container}" redis-cli PING 2>/dev/null)
        pass "Redis: ${ping}"
    fi

    local minio_container
    minio_container=$(get_container "vrixo.*minio") || minio_container=$(get_container "minio")
    if [ -n "${minio_container}" ]; then
        local status
        status=$(docker exec "${minio_container}" curl -sf -o /dev/null -w "%{http_code}" http://localhost:9000/minio/health/live 2>/dev/null)
        pass "MinIO: HTTP ${status}"
    fi
}

main() {
    [ -z "${BACKUP_DIR}" ] && {
        echo "Usage: $0 <backup_directory> [options]"
        echo "Available backups:"
        [ -d "${PROJECT_ROOT}/backups" ] && ls -1 "${PROJECT_ROOT}/backups/" 2>/dev/null | grep -E "^20[0-9]{6}_[0-9]{6}$" || true
        exit 1
    }
    [ ! -d "${BACKUP_DIR}" ] && log_error "Backup directory not found: ${BACKUP_DIR}" && exit 1

    echo "========================================="
    echo "  VrixoBase - Enhanced Restore"
    echo "  Source: ${BACKUP_DIR}"
    echo "  Type:   ${TYPE}"
    echo "========================================="
    echo ""

    decrypt_backup
    verify_integrity

    if ! $FORCE; then
        echo -e "${YELLOW}WARNING: This will OVERWRITE existing data!${NC}"
        read -rp "Are you sure? [y/N] " confirm
        [[ ! "${confirm}" =~ ^[yY](es)?$ ]] && log_info "Cancelled" && exit 0
    fi

    case "${TYPE}" in
        full) restore_full ;;
        table) restore_table ;;
        project) restore_project ;;
        *) log_error "Unknown type: ${TYPE}"; exit 1 ;;
    esac

    echo ""
    echo "========================================="
    log_info "Restore complete!"
    echo "========================================="
}

main
