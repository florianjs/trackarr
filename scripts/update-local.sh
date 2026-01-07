#!/bin/bash
# =============================================================================
# OpenTracker - Local Update Script
# =============================================================================
# Updates the local environment from git and restarts services
# Usage: ./scripts/update-local.sh
# =============================================================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' 

log_step() { echo -e "\n${BLUE}${BOLD}==> $1${NC}"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local-prod"

# Check if env file exists
if [ ! -f "$ENV_FILE" ]; then
    log_error "Environment file not found: $ENV_FILE"
    echo "Please run ./scripts/setup-local-prod.sh first to set up the environment."
    exit 1
fi

echo -e "${GREEN}${BOLD}"
echo "  ┌──────────────────────────────────────────────────────────────┐"
echo "  │       OpenTracker - Local Update                             │"
echo "  └──────────────────────────────────────────────────────────────┘"
echo -e "${NC}"

# 1. Git Pull
log_step "Fetching latest updates..."
if git pull; then
    log_success "Git repository updated"
else
    log_error "Failed to update git repository"
    exit 1
fi

# 2. Rebuild Containers
log_step "Rebuilding Docker services..."
cd "$PROJECT_DIR"
docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" build

# 3. Restart Services
log_step "Restarting services..."
docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" up -d

# 4. Run Migrations
log_step "Running database migrations..."
log_success "Waiting for services to be healthy..."
sleep 5

# Try to run migrations inside the container
if docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" exec -T app sh -c "cd /app && ./scripts/db-push.sh"; then
    log_success "Database migrations completed"
else
    log_error "Failed to run migrations"
    # Don't exit here, the app might still be running but just busy
fi

echo ""
echo -e "${GREEN}${BOLD}Update Complete!${NC}"
echo -e "Frontend: http://localhost:3000"
