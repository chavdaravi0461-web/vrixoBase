#!/usr/bin/env bash
set -euo pipefail

# VrixoBase - Enhanced Backup Script
# Usage: ./scripts/backup.sh [--output-dir <path>] [--encrypt] [--encryption-key <key>] [--retention-days <days>] [--skip-postgres] [--skip-redis] [--skip-minio] [--skip-verify]

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
RETENTION_DAYS=30
ENCRYPT=false
ENCRYPTION_KEY=""
SKIP_POSTGRES=false
SKIP_REDIS=false
SKIP_MINIO=false
SKIP_VERIFY=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --output-dir) BACKUP_DIR="$2"; shift 2 ;;
        --encrypt) ENCRYPT=true; shift ;;
        --encryption-key) ENCRYPTION_KEY="$2"; shift 2 ;;
        --retention-days) RETENTION_DAYS="$2"; shift 2 ;;
        --skip-postgres) SKIP_POSTGRES=true; shift ;;
        --skip-redis) SKIP_REDIS=true; shift ;;
        --skip-minio) SKIP_MINIO=true; shift ;;
        --skip-verify) SKIP_VERIFY=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

get_container() {
    local filter="$1"
    docker ps --filter "name=${filter}" --format "{{.Names}}" | head -1
}

cleanup_old_backups() {
    log_info "Cleaning backups older than ${RETENTION_DAYS} days..."
    find "${BACKUP_DIR}" -maxdepth 1 -type d -name "20*" -mtime "+${RETENTION_DAYS}" -exec rm -rf {} \; 2>/dev/null || true
    log_info "Old backups cleaned"
}

backup_postgres() {
    $SKIP_POSTGRES && log_warn "Skipping PostgreSQL backup" && return
    log_info "Backing up PostgreSQL..."

    local container
    container=$(get_container "vrixo.*postgres") || container=$(get_container "postgres")
    [ -z "${container}" ] && log_warn "PostgreSQL container not found" && return

    # Full dump (custom format, compressed)
    docker exec "${container}" pg_dump --username=vrixo --dbname=vrixo --format=custom --compress=9 --file="/tmp/${TIMESTAMP}_full.dump" 2>/dev/null
    docker cp "${container}:/tmp/${TIMESTAMP}_full.dump" "${BACKUP_PATH}/postgres_full.dump"
    docker exec "${container}" rm -f "/tmp/${TIMESTAMP}_full.dump"

    # Globals dump
    docker exec "${container}" pg_dumpall --username=vrixo --globals-only --file="/tmp/${TIMESTAMP}_globals.sql" 2>/dev/null
    docker cp "${container}:/tmp/${TIMESTAMP}_globals.sql" "${BACKUP_PATH}/postgres_globals.sql"
    docker exec "${container}" rm -f "/tmp/${TIMESTAMP}_globals.sql"

    # Schema-only dump
    docker exec "${container}" pg_dump --username=vrixo --dbname=vrixo --schema-only --file="/tmp/${TIMESTAMP}_schema.sql" 2>/dev/null
    docker cp "${container}:/tmp/${TIMESTAMP}_schema.sql" "${BACKUP_PATH}/postgres_schema.sql"
    docker exec "${container}" rm -f "/tmp/${TIMESTAMP}_schema.sql"

    log_info "  PostgreSQL backup saved (full + globals + schema)"
}

backup_redis() {
    $SKIP_REDIS && log_warn "Skipping Redis backup" && return
    log_info "Backing up Redis..."

    local container
    container=$(get_container "vrixo.*redis") || container=$(get_container "redis")
    [ -z "${container}" ] && log_warn "Redis container not found" && return

    docker exec "${container}" redis-cli SAVE 2>/dev/null
    sleep 1
    docker cp "${container}:/data/dump.rdb" "${BACKUP_PATH}/redis.rdb"

    # Also backup AOF if enabled
    local aof_status
    aof_status=$(docker exec "${container}" redis-cli CONFIG GET appendonly 2>/dev/null | tail -1)
    if [ "${aof_status}" = "yes" ]; then
        docker exec "${container}" redis-cli BGREWRITEAOF 2>/dev/null
        sleep 2
        docker cp "${container}:/data/appendonly.aof" "${BACKUP_PATH}/redis.aof" 2>/dev/null || true
    fi

    # Export config
    docker exec "${container}" redis-cli CONFIG GET "*" 2>/dev/null > "${BACKUP_PATH}/redis_config.txt"

    log_info "  Redis backup saved (RDB + config)"
}

backup_minio() {
    $SKIP_MINIO && log_warn "Skipping MinIO backup" && return
    log_info "Backing up MinIO..."

    local container
    container=$(get_container "vrixo.*minio") || container=$(get_container "minio")
    [ -z "${container}" ] && log_warn "MinIO container not found" && return

    # Use docker cp approach - avoid tar in container if not available
    # MinIO container may not have tar, so we create archive via docker exec with tar
    docker exec "${container}" tar czf "/tmp/${TIMESTAMP}_minio.tar.gz" -C /data . 2>/dev/null || {
        log_warn "  tar not available in MinIO container, trying alternative..."
        local tmp_dir
        tmp_dir=$(mktemp -d)
        docker cp "${container}:/data/." "${tmp_dir}/" 2>/dev/null
        cd "${tmp_dir}" && tar czf "${BACKUP_PATH}/minio.tar.gz" .
        rm -rf "${tmp_dir}"
        log_info "  MinIO backup saved via docker cp"
        return
    }
    docker cp "${container}:/tmp/${TIMESTAMP}_minio.tar.gz" "${BACKUP_PATH}/minio.tar.gz"
    docker exec "${container}" rm -f "/tmp/${TIMESTAMP}_minio.tar.gz"

    log_info "  MinIO backup saved"
}

encrypt_backup() {
    $ENCRYPT || return
    [ -z "${ENCRYPTION_KEY}" ] && log_warn "Encryption skipped (provide --encryption-key)" && return

    log_info "Encrypting backup files..."
    cd "${BACKUP_PATH}"
    for f in *.dump *.rdb *.tar.gz *.sql *.txt; do
        [ ! -f "$f" ] && continue
        openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$f" -out "${f}.enc" -pass "pass:${ENCRYPTION_KEY}" 2>/dev/null
        if [ $? -eq 0 ]; then
            rm -f "$f"
            log_info "  Encrypted: ${f} -> ${f}.enc"
        else
            log_error "  Encryption failed for ${f}"
        fi
    done
}

create_checksums() {
    log_info "Creating checksums..."
    cd "${BACKUP_PATH}"
    sha256sum * 2>/dev/null > checksums.sha256 || true
    log_info "  Checksums saved"
}

verify_backup() {
    $SKIP_VERIFY && log_warn "Verification skipped" && return
    log_info "Verifying backup integrity..."

    cd "${BACKUP_PATH}"
    if [ ! -f checksums.sha256 ]; then
        log_warn "No checksums file found"
        return
    fi

    if sha256sum -c checksums.sha256 --quiet 2>/dev/null; then
        log_info "  All checksums verified successfully"
    else
        log_error "  Checksum verification FAILED!"
        exit 1
    fi
}

main() {
    mkdir -p "${BACKUP_PATH}"

    echo "========================================="
    echo "  VrixoBase - Enhanced Backup"
    echo "  Timestamp: ${TIMESTAMP}"
    echo "  Output:    ${BACKUP_PATH}"
    echo "  Encrypt:   ${ENCRYPT}"
    echo "========================================="
    echo ""

    backup_postgres
    backup_redis
    backup_minio
    create_checksums
    encrypt_backup
    verify_backup
    cleanup_old_backups

    echo ""
    echo "========================================="
    log_info "Backup complete!"
    echo "  Location: ${BACKUP_PATH}"
    echo "========================================="
}

main
