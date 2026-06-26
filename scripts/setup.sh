#!/usr/bin/env bash
set -euo pipefail

# VrixoBase - Setup Script
# Usage: ./scripts/setup.sh [--dev] [--prod]

MODE="${1:---dev}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "========================================="
echo "  VrixoBase - Setup Script"
echo "  Mode: ${MODE}"
echo "========================================="

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

check_prerequisites() {
    log_info "Checking prerequisites..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Install at: https://docs.docker.com/get-docker/"
        exit 1
    fi
    log_info "  Docker: $(docker --version)"

    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            log_error "Docker Compose is not installed."
            exit 1
        fi
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    log_info "  Docker Compose: available"

    if ! command -v node &> /dev/null; then
        log_warn "  Node.js not found on host (only needed for local dev)"
    else
        log_info "  Node: $(node --version)"
    fi

    if ! command -v openssl &> /dev/null; then
        log_error "OpenSSL is required for generating secrets."
        exit 1
    fi
    log_info "  OpenSSL: available"
}

setup_environment() {
    log_info "Setting up environment..."

    if [ ! -f "${PROJECT_ROOT}/.env" ]; then
        if [ -f "${PROJECT_ROOT}/.env.example" ]; then
            cp "${PROJECT_ROOT}/.env.example" "${PROJECT_ROOT}/.env"
            log_info "  Created .env from .env.example"
        else
            log_error ".env.example not found!"
            exit 1
        fi
    else
        log_info "  .env already exists, skipping"
    fi

    log_info "Generating JWT secrets..."
    JWT_SECRET=$(openssl rand -base64 48)
    JWT_REFRESH_SECRET=$(openssl rand -base64 48)

    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "${PROJECT_ROOT}/.env"
        sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "${PROJECT_ROOT}/.env"
    else
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" "${PROJECT_ROOT}/.env"
        sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" "${PROJECT_ROOT}/.env"
    fi

    log_info "  JWT secrets generated and written to .env"
}

install_dependencies() {
    log_info "Installing dependencies..."

    if [ -d "${PROJECT_ROOT}/backend/node_modules" ]; then
        log_info "  Backend dependencies already installed, skipping"
    else
        cd "${PROJECT_ROOT}/backend"
        npm install
        log_info "  Backend dependencies installed"
    fi

    if [ -d "${PROJECT_ROOT}/frontend/node_modules" ]; then
        log_info "  Frontend dependencies already installed, skipping"
    else
        cd "${PROJECT_ROOT}/frontend"
        npm install
        log_info "  Frontend dependencies installed"
    fi
}

run_database_migrations() {
    log_info "Running database migrations..."

    cd "${PROJECT_ROOT}/backend"

    log_info "  Generating Prisma client..."
    npx prisma generate

    log_info "  Running migrations..."
    npx prisma migrate deploy
}

seed_database() {
    log_info "Seeding database..."

    cd "${PROJECT_ROOT}/backend"

    if [ -f prisma/seed.ts ]; then
        npx ts-node prisma/seed.ts
        log_info "  Database seeded"
    else
        log_warn "  Seed file not found, skipping"
    fi
}

build_docker_images() {
    log_info "Building Docker images..."

    cd "${PROJECT_ROOT}"

    if [ "${MODE}" == "--prod" ]; then
        ${COMPOSE_CMD} -f docker-compose.yml -f infra/docker-compose.prod.yml build
    else
        ${COMPOSE_CMD} build
    fi

    log_info "Docker images built"
}

start_services() {
    log_info "Starting services..."

    cd "${PROJECT_ROOT}"

    if [ "${MODE}" == "--prod" ]; then
        ${COMPOSE_CMD} -f docker-compose.yml -f infra/docker-compose.prod.yml up -d
    else
        ${COMPOSE_CMD} up -d
    fi

    log_info "Services started"
}

print_urls() {
    echo ""
    echo "========================================="
    echo "  VrixoBase is running!"
    echo "========================================="
    echo ""
    echo "  Frontend:   http://localhost:3000"
    echo "  Backend:    http://localhost:4000"
    echo "  API Docs:   http://localhost:4000/api"
    echo "  MinIO:      http://localhost:9001"
    echo "  MinIO API:  http://localhost:9000"
    echo "  PostgreSQL: localhost:5432"
    echo "  Redis:      localhost:6379"
    echo ""
    if [ "${MODE}" == "--prod" ]; then
        echo "  Nginx:      http://localhost:80"
        echo "  Nginx SSL:  https://localhost:443"
    fi
    echo ""
    echo "========================================="
}

main() {
    check_prerequisites
    setup_environment

    if [ "${MODE}" == "--dev" ]; then
        install_dependencies
        run_database_migrations
        seed_database
    fi

    build_docker_images
    start_services
    print_urls
}

main
