#!/bin/bash
# =============================================================================
# Trackarr - Quick Docker Setup
# =============================================================================
# Interactive setup for Docker deployments.
# Creates .env file with proper configuration for development or production.
#
# Usage: ./scripts/setup.sh
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
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo ""
echo -e "${CYAN}${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}${BOLD}║          Trackarr - Docker Setup                       ║${NC}"
echo -e "${CYAN}${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if .env.example exists
if [[ ! -f "$PROJECT_DIR/.env.example" ]]; then
    log_error ".env.example not found. Are you in the Trackarr directory?"
fi

# Check if .env already exists
if [[ -f "$PROJECT_DIR/.env" ]]; then
    echo -e "${YELLOW}A .env file already exists.${NC}"
    read -p "Overwrite it? (y/N): " OVERWRITE
    if [[ ! $OVERWRITE =~ ^[Yy]$ ]]; then
        echo "Setup cancelled."
        exit 0
    fi
fi

# Ask for environment type
echo ""
echo -e "${BOLD}Select environment:${NC}"
echo "  1) Development (local testing, no SSL)"
echo "  2) Production (Docker on VPS with SSL)"
echo ""
read -p "Choice [1-2]: " ENV_CHOICE

case $ENV_CHOICE in
    1) ENV_TYPE="development" ;;
    2) ENV_TYPE="production" ;;
    *) log_error "Invalid choice" ;;
esac

# Copy base config
cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
log_success "Created .env from .env.example"

if [[ "$ENV_TYPE" == "development" ]]; then
    # Development: just use defaults
    echo ""
    log_success "Development setup complete!"
    echo ""
    echo -e "${BOLD}Next steps:${NC}"
    echo "  docker compose up -d"
    echo "  Open http://localhost:3000"
    echo ""
    exit 0
fi

# =============================================================================
# PRODUCTION SETUP
# =============================================================================
echo ""
echo -e "${BOLD}Production Configuration${NC}"
echo ""

# Domain configuration
read -p "Main domain (e.g., tracker.example.com): " DOMAIN
if [[ -z "$DOMAIN" ]]; then
    log_error "Domain is required for production"
fi

read -p "Tracker subdomain [tracker.$DOMAIN]: " TRACKER_DOMAIN
TRACKER_DOMAIN="${TRACKER_DOMAIN:-tracker.$DOMAIN}"

read -p "Monitoring subdomain [monitoring.$DOMAIN]: " MONITORING_DOMAIN
MONITORING_DOMAIN="${MONITORING_DOMAIN:-monitoring.$DOMAIN}"

read -p "Email for SSL certificates: " ACME_EMAIL
if [[ -z "$ACME_EMAIL" ]]; then
    log_error "Email is required for Let's Encrypt SSL"
fi

# Generate secrets
log_info "Generating cryptographic secrets..."
NUXT_SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_API_KEY=$(openssl rand -hex 32)
IP_HASH_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
REDIS_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=')
GRAFANA_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')

# Update .env file
log_info "Updating .env file..."

# Use sed to update values (compatible with both Linux and macOS)
sed_inplace() {
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sed -i '' "$@"
    else
        sed -i "$@"
    fi
}

# Environment
sed_inplace "s/^NODE_ENV=.*/NODE_ENV=production/" "$PROJECT_DIR/.env"

# Domains
sed_inplace "s|^# DOMAIN=.*|DOMAIN=$DOMAIN|" "$PROJECT_DIR/.env"
sed_inplace "s|^# TRACKER_DOMAIN=.*|TRACKER_DOMAIN=$TRACKER_DOMAIN|" "$PROJECT_DIR/.env"
sed_inplace "s|^# MONITORING_DOMAIN=.*|MONITORING_DOMAIN=$MONITORING_DOMAIN|" "$PROJECT_DIR/.env"
sed_inplace "s|^# ACME_EMAIL=.*|ACME_EMAIL=$ACME_EMAIL|" "$PROJECT_DIR/.env"

# Database
sed_inplace "s|^DATABASE_URL=.*|DATABASE_URL=postgres://tracker:$DB_PASSWORD@pgbouncer:6432/trackarr|" "$PROJECT_DIR/.env"
sed_inplace "s/^DB_PASSWORD=.*/DB_PASSWORD=$DB_PASSWORD/" "$PROJECT_DIR/.env"

# Redis
sed_inplace "s|^REDIS_URL=.*|REDIS_URL=redis://redis:6379|" "$PROJECT_DIR/.env"
sed_inplace "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD/" "$PROJECT_DIR/.env"

# Security
sed_inplace "s/^NUXT_SESSION_SECRET=.*/NUXT_SESSION_SECRET=$NUXT_SESSION_SECRET/" "$PROJECT_DIR/.env"
sed_inplace "s/^ADMIN_API_KEY=.*/ADMIN_API_KEY=$ADMIN_API_KEY/" "$PROJECT_DIR/.env"
sed_inplace "s/^IP_HASH_SECRET=.*/IP_HASH_SECRET=$IP_HASH_SECRET/" "$PROJECT_DIR/.env"

# Tracker URLs
sed_inplace "s|^TRACKER_HTTP_URL=.*|TRACKER_HTTP_URL=https://$TRACKER_DOMAIN/announce|" "$PROJECT_DIR/.env"
sed_inplace "s|^TRACKER_UDP_URL=.*|TRACKER_UDP_URL=udp://$TRACKER_DOMAIN:8081/announce|" "$PROJECT_DIR/.env"
sed_inplace "s|^TRACKER_WS_URL=.*|TRACKER_WS_URL=wss://$TRACKER_DOMAIN/ws|" "$PROJECT_DIR/.env"

# Monitoring
sed_inplace "s|^# GRAFANA_ADMIN_USER=.*|GRAFANA_ADMIN_USER=admin|" "$PROJECT_DIR/.env"
sed_inplace "s|^# GRAFANA_ADMIN_PASSWORD=.*|GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD|" "$PROJECT_DIR/.env"

echo ""
log_success "Production setup complete!"
echo ""
echo -e "${BOLD}Generated credentials (save these!):${NC}"
echo -e "  Database password: ${CYAN}$DB_PASSWORD${NC}"
echo -e "  Redis password:    ${CYAN}$REDIS_PASSWORD${NC}"
echo -e "  Grafana password:  ${CYAN}$GRAFANA_PASSWORD${NC}"
echo ""
echo -e "${BOLD}Configured domains:${NC}"
echo -e "  Main:       https://$DOMAIN"
echo -e "  Tracker:    https://$TRACKER_DOMAIN"
echo -e "  Monitoring: https://$MONITORING_DOMAIN/grafana"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Ensure DNS A records point to your server IP:"
echo "     - $DOMAIN"
echo "     - $TRACKER_DOMAIN"
echo "     - $MONITORING_DOMAIN"
echo ""
echo "  2. Start the production stack:"
echo "     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "  3. View logs:"
echo "     docker compose -f docker-compose.prod.yml logs -f app"
echo ""
