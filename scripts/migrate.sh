#!/usr/bin/env bash
set -euo pipefail

MIGRATE_CMD=${1:-"deploy"}
MIGRATION_NAME=${2:-""}
SCHEMA="backend/prisma/schema.prisma"

log() {
  echo "[migrate] $(date '+%Y-%m-%d %H:%M:%S') $*" >&2
}

error() {
  log "ERROR: $*" >&2
  exit 1
}

require_env() {
  local var=$1
  if [ -z "${!var:-}" ]; then
    error "Required environment variable $var is not set"
  fi
}

deploy() {
  log "Running prisma migrate deploy..."
  if npx prisma migrate deploy --schema="$SCHEMA"; then
    log "Migration applied successfully"
  else
    log "Migration failed, attempting rollback..."
    rollback
    error "Migration failed, rollback completed"
  fi
}

create() {
  if [ -z "$MIGRATION_NAME" ]; then
    error "Migration name is required. Usage: migrate.sh create <name>"
  fi
  log "Creating migration: $MIGRATION_NAME"
  npx prisma migrate dev --schema="$SCHEMA" --name "$MIGRATION_NAME" --create-only
  log "Migration created: $MIGRATION_NAME"
}

rollback() {
  log "Rolling back last migration..."
  local last_migration
  last_migration=$(npx prisma migrate status --schema="$SCHEMA" 2>/dev/null | grep -i "down" | head -1 | awk '{print $2}' || true)

  if [ -n "$last_migration" ]; then
    npx prisma migrate resolve --schema="$SCHEMA" --rolled-back "$last_migration"
    log "Rolled back: $last_migration"
  else
    log "No migration to rollback found"
  fi
}

reset() {
  log "WARNING: This will reset the database! Waiting 5s..."
  sleep 5
  require_env "DATABASE_URL"
  npx prisma migrate reset --schema="$SCHEMA" --force
  log "Database reset completed"
}

validate() {
  log "Validating migrations..."
  npx prisma validate --schema="$SCHEMA"
  log "Schema validation passed"
}

status() {
  log "Migration status:"
  npx prisma migrate status --schema="$SCHEMA"
}

case "$MIGRATE_CMD" in
  deploy)
    deploy
    ;;
  create)
    create
    ;;
  rollback)
    rollback
    ;;
  reset)
    reset
    ;;
  validate)
    validate
    ;;
  status)
    status
    ;;
  *)
    echo "Usage: $0 {deploy|create|rollback|reset|validate|status} [name]" >&2
    exit 1
    ;;
esac
