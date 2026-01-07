#!/bin/bash
# =============================================================================
# Trackarr - Local Production Setup Script
# =============================================================================
# Quickly sets up a local production environment with OrbStack
# Usage: ./scripts/setup-local-prod.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step() { echo -e "\n${CYAN}${BOLD}==> $1${NC}"; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.local-prod"

echo ""
echo -e "${GREEN}${BOLD}"
echo "  ┌──────────────────────────────────────────────────────────────┐"
echo "  │       Trackarr - Local Production Setup                   │"
echo "  │                    with OrbStack                             │"
echo "  └──────────────────────────────────────────────────────────────┘"
echo -e "${NC}"

# =============================================================================
# Check Prerequisites
# =============================================================================
log_step "Checking prerequisites..."

# Check for Docker/OrbStack
if ! command -v docker &> /dev/null; then
    log_error "Docker not found. Please install OrbStack first:"
    echo "  brew install orbstack"
    exit 1
fi

# Check if OrbStack is running
if command -v orb &> /dev/null; then
    log_success "OrbStack detected"
else
    log_warn "OrbStack CLI not found. Using standard Docker."
fi

# =============================================================================
# Generate Secrets
# =============================================================================
log_step "Generating secure secrets..."


# Function to get secret from existing env file
get_existing_secret() {
    local key=$1
    if [ -f "$ENV_FILE" ]; then
        # Grep the line, cut after the first =, and remove any surrounding quotes if present
        grep "^$key=" "$ENV_FILE" | head -n 1 | cut -d'=' -f2- | sed 's/^"//;s/"$//'
    fi
}

log_step "Generating secure secrets..."

# Try to read existing secrets first to preserve them (prevents DB auth errors on re-run)
EXISTING_DB_PASSWORD=$(get_existing_secret "DB_PASSWORD")
EXISTING_REDIS_PASSWORD=$(get_existing_secret "REDIS_PASSWORD")
EXISTING_NUXT_SESSION_SECRET=$(get_existing_secret "NUXT_SESSION_SECRET")
EXISTING_IP_HASH_SECRET=$(get_existing_secret "IP_HASH_SECRET")
EXISTING_ADMIN_API_KEY=$(get_existing_secret "ADMIN_API_KEY")

if [ -n "$EXISTING_DB_PASSWORD" ]; then
    log_info "Preserving existing secrets from $ENV_FILE"
    DB_PASSWORD=$EXISTING_DB_PASSWORD
    REDIS_PASSWORD=$EXISTING_REDIS_PASSWORD
    NUXT_SESSION_SECRET=$EXISTING_NUXT_SESSION_SECRET
    IP_HASH_SECRET=$EXISTING_IP_HASH_SECRET
    ADMIN_API_KEY=$EXISTING_ADMIN_API_KEY
else
    DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
    NUXT_SESSION_SECRET=$(openssl rand -hex 32)
    IP_HASH_SECRET=$(openssl rand -hex 32)
    ADMIN_API_KEY=$(openssl rand -hex 24)
    log_success "Secrets generated"
fi



# =============================================================================
# Create .env file
# =============================================================================
log_step "Creating environment file..."

cat > "$ENV_FILE" << EOF
# =============================================================================
# Trackarr - Local Production Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# =============================================================================
# This file is for LOCAL PRODUCTION TESTING with OrbStack
# DO NOT use these credentials in real production!
# =============================================================================

NODE_ENV=production

# =============================================================================
# Database (PostgreSQL)
# =============================================================================
DB_USER=tracker
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=trackarr
DB_HOST=postgres
DB_PORT=5432
DATABASE_URL=postgres://tracker:${DB_PASSWORD}@postgres:5432/trackarr

# =============================================================================
# Cache (Redis)
# =============================================================================
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# =============================================================================
# Security
# =============================================================================
NUXT_SESSION_SECRET=${NUXT_SESSION_SECRET}
IP_HASH_SECRET=${IP_HASH_SECRET}
ADMIN_API_KEY=${ADMIN_API_KEY}

# =============================================================================
# Tracker URLs (Local OrbStack domains)
# =============================================================================
TRACKER_HTTP_URL=http://localhost:8080/announce
TRACKER_UDP_URL=
TRACKER_WS_URL=

# =============================================================================
# Monitoring (Grafana)
# =============================================================================
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
EOF

chmod 600 "$ENV_FILE"
log_success "Environment file created: $ENV_FILE"

# =============================================================================
# Stop existing containers (aggressive cleanup)
# =============================================================================
log_step "Stopping any existing containers..."

cd "$PROJECT_DIR"

# Stop both local and prod compose (in case either was running)
docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" down 2>/dev/null || true
docker compose -f docker-compose.prod.yml down 2>/dev/null || true

# Also stop any containers with opentracker in the name
docker stop $(docker ps -q --filter "name=trackarr") 2>/dev/null || true
docker rm $(docker ps -aq --filter "name=trackarr") 2>/dev/null || true

log_success "Cleanup complete"

# =============================================================================
# Build and start
# =============================================================================
log_step "Building Docker image..."

docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" build

log_step "Starting services..."

docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" up -d

# =============================================================================
# Wait for services
# =============================================================================
log_step "Waiting for services to be ready..."

sleep 5

# Wait for PostgreSQL
for i in {1..30}; do
    if docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" exec -T postgres pg_isready -U tracker -d trackarr &> /dev/null; then
        log_success "PostgreSQL is ready"
        break
    fi
    echo -n "."
    sleep 2
done

# Wait for Redis
for i in {1..15}; do
    if docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" exec -T redis redis-cli -a "$REDIS_PASSWORD" PING 2>/dev/null | grep -q PONG; then
        log_success "Redis is ready"
        break
    fi
    echo -n "."
    sleep 1
done

# =============================================================================
# Run migrations
# =============================================================================
log_step "Running database migrations..."

# The entrypoint.sh should handle this, but we can also run manually
docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" exec -T app sh -c "cd /app && ./scripts/db-push.sh" 2>/dev/null || \
    log_warn "Migrations may have already run via entrypoint"

# =============================================================================
# Print Summary
# =============================================================================
log_step "Setup Complete!"

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║           Local Production Environment Ready!                    ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BOLD}Access URLs:${NC}"
echo -e "  Frontend:     ${CYAN}http://localhost:3000${NC}"
echo -e "  Tracker:      ${CYAN}http://localhost:8080/announce${NC}"
echo -e "  Grafana:      ${CYAN}http://localhost:3001${NC} (admin/admin)"
echo ""
if command -v orb &> /dev/null; then
    echo -e "${BOLD}OrbStack Domains:${NC}"
    echo -e "  Frontend:     ${CYAN}http://trackarr.orb.local:3000${NC}"
    echo -e "  Grafana:      ${CYAN}http://trackarr-grafana.orb.local:3000${NC}"
    echo ""
fi
echo -e "${BOLD}Environment File:${NC}"
echo -e "  ${CYAN}$ENV_FILE${NC}"
echo ""
echo -e "${BOLD}Useful Commands:${NC}"
echo -e "  View logs:      ${CYAN}docker compose -f docker-compose.local.yml --env-file .env.local-prod logs -f${NC}"
echo -e "  Stop:           ${CYAN}docker compose -f docker-compose.local.yml --env-file .env.local-prod down${NC}"
echo -e "  Restart:        ${CYAN}docker compose -f docker-compose.local.yml --env-file .env.local-prod restart${NC}"
echo ""
echo -e "${YELLOW}${BOLD}⚠️  This is for LOCAL TESTING only. Do not expose to the internet.${NC}"
echo ""

# Check service status
log_step "Service Status:"
docker compose -f docker-compose.local.yml --env-file "$ENV_FILE" ps
