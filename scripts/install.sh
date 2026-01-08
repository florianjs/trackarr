#!/bin/bash
# =============================================================================
# Trackarr - Complete Server Installation Script
# =============================================================================
# This script installs and configures Trackarr from scratch on a fresh server
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+, Amazon Linux 2
# =============================================================================

set -e

# =============================================================================
# COLORS AND HELPERS
# =============================================================================
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

# =============================================================================
# CONFIGURATION
# =============================================================================
INSTALL_DIR="${INSTALL_DIR:-/opt/trackarr}"
REPO_URL="${REPO_URL:-https://github.com/florianjs/trackarr.git}"
BRANCH="${BRANCH:-main}"

# Domain configuration (will be prompted if not set)
DOMAIN="${DOMAIN:-}"
TRACKER_DOMAIN="${TRACKER_DOMAIN:-}"
MONITORING_DOMAIN="${MONITORING_DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"

# Database defaults
DB_NAME="${DB_NAME:-trackarr}"
DB_USER="${DB_USER:-tracker}"

# =============================================================================
# PREFLIGHT CHECKS
# =============================================================================
preflight_checks() {
    log_step "Running preflight checks..."
    
    # Check if running as root
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
    
    # Check minimum RAM (2GB recommended)
    TOTAL_RAM=$(free -m | awk '/^Mem:/{print $2}')
    if [[ $TOTAL_RAM -lt 1500 ]]; then
        log_warn "System has less than 2GB RAM. Trackarr may run slowly."
        read -p "Continue anyway? (y/N): " CONTINUE
        if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    # Check available disk space (10GB minimum)
    AVAILABLE_DISK=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ $AVAILABLE_DISK -lt 10 ]]; then
        log_warn "Less than 10GB disk space available."
        read -p "Continue anyway? (y/N): " CONTINUE
        if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    log_success "Preflight checks passed"
}

# =============================================================================
# DETECT OS
# =============================================================================
detect_os() {
    log_step "Detecting operating system..."
    
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    elif [[ -f /etc/redhat-release ]]; then
        OS="centos"
        VERSION=$(cat /etc/redhat-release | grep -oE '[0-9]+' | head -1)
    else
        log_error "Unable to detect operating system"
        exit 1
    fi
    
    log_info "Detected: $OS $VERSION"
    
    case $OS in
        ubuntu|debian)
            PKG_MANAGER="apt-get"
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            ;;
        centos|rhel|fedora|rocky|almalinux)
            PKG_MANAGER="dnf"
            PKG_UPDATE="dnf check-update || true"
            PKG_INSTALL="dnf install -y -q"
            ;;
        amzn)
            PKG_MANAGER="yum"
            PKG_UPDATE="yum check-update || true"
            PKG_INSTALL="yum install -y -q"
            ;;
        *)
            log_error "Unsupported operating system: $OS"
            exit 1
            ;;
    esac
    
    log_success "Package manager: $PKG_MANAGER"
}

# =============================================================================
# INSTALL SYSTEM DEPENDENCIES
# =============================================================================
install_dependencies() {
    log_step "Installing system dependencies..."
    
    $PKG_UPDATE
    
    case $OS in
        ubuntu|debian)
            $PKG_INSTALL curl wget git openssl ca-certificates gnupg lsb-release
            ;;
        centos|rhel|fedora|rocky|almalinux)
            $PKG_INSTALL curl wget git openssl ca-certificates
            ;;
        amzn)
            $PKG_INSTALL curl wget git openssl
            ;;
    esac
    
    log_success "System dependencies installed"
}

# =============================================================================
# INSTALL DOCKER
# =============================================================================
install_docker() {
    log_step "Checking Docker installation..."
    
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version | awk '{print $3}' | tr -d ',')
        log_info "Docker already installed: $DOCKER_VERSION"
        
        # Check Docker Compose
        if docker compose version &> /dev/null; then
            log_info "Docker Compose (plugin) already available"
            return 0
        elif command -v docker-compose &> /dev/null; then
            log_info "Docker Compose (standalone) already available"
            return 0
        fi
    fi
    
    log_info "Installing Docker..."
    
    case $OS in
        ubuntu|debian)
            # Remove old versions
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
            
            # Add Docker's official GPG key
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
            chmod a+r /etc/apt/keyrings/docker.gpg
            
            # Add the repository
            echo \
              "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
              $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
              tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            apt-get update -qq
            apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        centos|rhel|rocky|almalinux)
            dnf remove -y docker docker-client docker-client-latest docker-common docker-latest \
                docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            
            dnf install -y dnf-plugins-core
            dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        fedora)
            dnf remove -y docker docker-client docker-client-latest docker-common docker-latest \
                docker-latest-logrotate docker-logrotate docker-selinux docker-engine-selinux docker-engine 2>/dev/null || true
            
            dnf install -y dnf-plugins-core
            dnf config-manager --add-repo https://download.docker.com/linux/fedora/docker-ce.repo
            dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
            ;;
            
        amzn)
            yum remove -y docker docker-client docker-client-latest docker-common docker-latest \
                docker-latest-logrotate docker-logrotate docker-engine 2>/dev/null || true
            
            amazon-linux-extras install docker -y || yum install -y docker
            ;;
    esac
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker
    
    # Verify installation
    docker --version
    docker compose version 2>/dev/null || docker-compose --version
    
    log_success "Docker installed successfully"
}

# =============================================================================
# CONFIGURE FIREWALL
# =============================================================================
configure_firewall() {
    log_step "Configuring firewall..."
    
    # Check for UFW (Ubuntu/Debian)
    if command -v ufw &> /dev/null; then
        log_info "Configuring UFW firewall..."
        ufw --force enable
        ufw allow ssh
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 443/udp  # HTTP/3
        ufw reload
        log_success "UFW configured"
        return 0
    fi
    
    # Check for firewalld (CentOS/RHEL)
    if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
        log_info "Configuring firewalld..."
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-port=443/udp  # HTTP/3
        firewall-cmd --reload
        log_success "firewalld configured"
        return 0
    fi
    
    log_warn "No firewall detected. Please configure manually."
}

# =============================================================================
# PROMPT FOR CONFIGURATION
# =============================================================================
prompt_configuration() {
    log_step "Configuration Setup"
    
    echo ""
    echo -e "${BOLD}Please provide the following information:${NC}"
    echo ""
    
    # Domain
    if [[ -z "$DOMAIN" ]]; then
        read -p "Main domain (e.g., tracker.example.com): " DOMAIN
        while [[ -z "$DOMAIN" ]]; do
            log_error "Domain is required"
            read -p "Main domain: " DOMAIN
        done
    fi
    
    # Tracker subdomain
    if [[ -z "$TRACKER_DOMAIN" ]]; then
        DEFAULT_TRACKER="announce.${DOMAIN}"
        read -p "Tracker announce domain [$DEFAULT_TRACKER]: " TRACKER_DOMAIN
        TRACKER_DOMAIN="${TRACKER_DOMAIN:-$DEFAULT_TRACKER}"
    fi
    
    # Monitoring subdomain
    if [[ -z "$MONITORING_DOMAIN" ]]; then
        DEFAULT_MONITORING="monitoring.${DOMAIN}"
        read -p "Monitoring domain [$DEFAULT_MONITORING]: " MONITORING_DOMAIN
        MONITORING_DOMAIN="${MONITORING_DOMAIN:-$DEFAULT_MONITORING}"
    fi
    
    # ACME Email
    if [[ -z "$ACME_EMAIL" ]]; then
        read -p "Email for Let's Encrypt SSL certificates: " ACME_EMAIL
        while [[ -z "$ACME_EMAIL" ]]; do
            log_error "Email is required for SSL certificates"
            read -p "Email: " ACME_EMAIL
        done
    fi
    
    # Monitoring basic auth password
    read -sp "Monitoring basic auth password (leave empty to generate): " MONITORING_PASSWORD
    echo ""
    if [[ -z "$MONITORING_PASSWORD" ]]; then
        MONITORING_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=' | head -c 16)
        log_info "Generated monitoring password"
    fi
    
    echo ""
    log_success "Configuration collected"
}

# =============================================================================
# GENERATE SECRETS
# =============================================================================
generate_secrets() {
    log_step "Generating cryptographic secrets..."
    
    SECRETS_DIR="$INSTALL_DIR/secrets"
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"
    
    # Database password (32 chars, alphanumeric)
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    echo -n "$DB_PASSWORD" > "$SECRETS_DIR/db_password.txt"
    log_info "Generated database password"
    
    # Redis password (32 chars)
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    echo -n "$REDIS_PASSWORD" > "$SECRETS_DIR/redis_password.txt"
    log_info "Generated Redis password"
    
    # Admin API key (48 chars)
    ADMIN_API_KEY=$(openssl rand -base64 48 | tr -d '/+=' | head -c 48)
    echo -n "$ADMIN_API_KEY" > "$SECRETS_DIR/admin_api_key.txt"
    log_info "Generated admin API key"
    
    # IP hash secret (64 chars)
    IP_HASH_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
    echo -n "$IP_HASH_SECRET" > "$SECRETS_DIR/ip_hash_secret.txt"
    log_info "Generated IP hash secret"
    
    # Nuxt session secret (64 chars)
    NUXT_SESSION_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
    echo -n "$NUXT_SESSION_SECRET" > "$SECRETS_DIR/nuxt_session_secret.txt"
    log_info "Generated Nuxt session secret"
    
    # Generate Caddy password hash
    MONITORING_PASSWORD_HASH=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$MONITORING_PASSWORD" 2>/dev/null || echo "")
    if [[ -z "$MONITORING_PASSWORD_HASH" ]]; then
        log_warn "Could not generate Caddy password hash. Will generate after Docker pull."
    fi
    
    # Set restrictive permissions
    chmod 600 "$SECRETS_DIR"/*
    
    log_success "Secrets generated and saved to $SECRETS_DIR"
}

# =============================================================================
# CREATE ENVIRONMENT FILE
# =============================================================================
create_env_file() {
    log_step "Creating environment configuration..."
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    # Generate monitoring password hash if not done yet
    if [[ -z "$MONITORING_PASSWORD_HASH" ]]; then
        log_info "Generating Caddy password hash..."
        MONITORING_PASSWORD_HASH=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$MONITORING_PASSWORD" 2>/dev/null)
    fi
    
    cat > "$ENV_FILE" << EOF
# =============================================================================
# Trackarr Production Environment Configuration
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# =============================================================================

# Application
NODE_ENV=production
NUXT_SESSION_SECRET=${NUXT_SESSION_SECRET}

# Database (PostgreSQL)
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=${DB_NAME}
DB_HOST=postgres
DB_PORT=5432
DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@pgbouncer:6432/${DB_NAME}

# Cache (Redis)
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
REDIS_KEY_PREFIX=tr:

# Security
ADMIN_API_KEY=${ADMIN_API_KEY}
IP_HASH_SECRET=${IP_HASH_SECRET}

# Domains
DOMAIN=${DOMAIN}
TRACKER_DOMAIN=${TRACKER_DOMAIN}
MONITORING_DOMAIN=${MONITORING_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# Tracker Announce URLs (displayed in admin dashboard)
TRACKER_HTTP_URL=https://${TRACKER_DOMAIN}/announce
TRACKER_UDP_URL=udp://${TRACKER_DOMAIN}:6969/announce
TRACKER_WS_URL=wss://${TRACKER_DOMAIN}/websocket

# Monitoring
MONITORING_USER=admin
# Note: $ escaped as $$ for Docker Compose compatibility
MONITORING_PASSWORD_HASH=$(echo "${MONITORING_PASSWORD_HASH}" | sed 's/\$/\$\$/g')
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=admin
EOF
    
    chmod 600 "$ENV_FILE"
    
    log_success "Environment file created: $ENV_FILE"
}

# =============================================================================
# UPDATE PGBOUNCER CONFIGURATION
# =============================================================================
update_pgbouncer_config() {
    log_step "Updating PgBouncer configuration..."
    
    # Update userlist.txt with actual password
    USERLIST_FILE="$INSTALL_DIR/docker/pgbouncer/userlist.txt"
    
    if [[ -f "$USERLIST_FILE" ]]; then
        # Generate MD5 hash for PgBouncer
        MD5_HASH=$(echo -n "${DB_PASSWORD}${DB_USER}" | md5sum | awk '{print $1}')
        echo "\"${DB_USER}\" \"md5${MD5_HASH}\"" > "$USERLIST_FILE"
        chmod 600 "$USERLIST_FILE"
        log_success "PgBouncer userlist updated"
    else
        log_warn "PgBouncer userlist not found. Will be created on first start."
    fi
}

# =============================================================================
# CLONE OR UPDATE REPOSITORY
# =============================================================================
setup_repository() {
    log_step "Setting up Trackarr repository..."
    
    if [[ -d "$INSTALL_DIR/.git" ]]; then
        log_info "Repository exists. Pulling latest changes..."
        cd "$INSTALL_DIR"
        git fetch origin
        git checkout "$BRANCH"
        git pull origin "$BRANCH"
    elif [[ -d "$INSTALL_DIR" ]] && [[ "$(ls -A $INSTALL_DIR)" ]]; then
        # Check if Dockerfile exists (valid installation)
        if [[ -f "$INSTALL_DIR/Dockerfile" ]]; then
            log_info "Installation directory exists (local copy mode)"
            cd "$INSTALL_DIR"
        else
            log_warn "Directory exists but appears incomplete. Re-cloning..."
            rm -rf "$INSTALL_DIR"
            git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
            cd "$INSTALL_DIR"
        fi
    else
        log_info "Cloning repository..."
        git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
    
    log_success "Repository ready at $INSTALL_DIR"
}

# =============================================================================
# BUILD DOCKER IMAGE
# =============================================================================
build_application() {
    log_step "Building Trackarr Docker image..."
    
    cd "$INSTALL_DIR"
    
    # Build the image
    docker build -t trackarr:latest .
    
    log_success "Docker image built successfully"
}

# =============================================================================
# START SERVICES
# =============================================================================
start_services() {
    log_step "Starting Trackarr services..."
    
    cd "$INSTALL_DIR"
    
    # Check for existing postgres volume with potentially old credentials
    if docker volume ls -q | grep -q "trackarr_postgres_data"; then
        log_warn "Existing database volume detected!"
        log_warn "This may contain data with different credentials than the newly generated ones."
        echo ""
        echo -e "${YELLOW}Options:${NC}"
        echo "  1) Delete existing volumes and start fresh (RECOMMENDED for new installs)"
        echo "  2) Keep existing volumes (use if upgrading and you want to preserve data)"
        echo ""
        read -p "Choose option (1/2): " VOLUME_CHOICE
        
        if [[ "$VOLUME_CHOICE" == "1" ]]; then
            log_info "Removing existing volumes..."
            docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
            log_success "Volumes removed"
        else
            log_warn "Keeping existing volumes. Make sure your .env credentials match the database!"
        fi
    fi
    
    # Pull required images first
    # log_info "Pulling Docker images..."
    # docker compose -f docker-compose.prod.yml pull
    
    # Start services
    log_info "Starting containers..."
    docker compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to become healthy..."
    sleep 10
    
    # Check service status
    docker compose -f docker-compose.prod.yml ps
    
    log_success "Services started"
}

# =============================================================================
# RUN DATABASE MIGRATIONS
# =============================================================================
run_migrations() {
    log_step "Running database migrations..."
    
    cd "$INSTALL_DIR"
    
    # Wait for PostgreSQL to be ready (connect to default postgres DB first)
    log_info "Waiting for database service to be ready..."
    for i in {1..30}; do
        if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U "$DB_USER" -d "postgres" &> /dev/null; then
            log_success "Database service is ready"
            break
        fi
        sleep 2
    done

    # Check/Rename database
    log_info "Verifying database name..."
    if docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log_success "Database '$DB_NAME' exists"
    elif docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres -lqt | cut -d \| -f 1 | grep -qw "opentracker"; then
        log_warn "Found legacy database 'opentracker'. Renaming to '$DB_NAME'..."
        docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'opentracker';" > /dev/null 2>&1 || true
        docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres -c "ALTER DATABASE opentracker RENAME TO \"$DB_NAME\";"
        log_success "Database renamed successfully"
    else
        log_warn "Database '$DB_NAME' not found. Creating..."
        docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
        log_success "Database created"
    fi
    
    # Wait for target database to be ready
    log_info "Waiting for $DB_NAME database to be ready..."
    for i in {1..30}; do
        if docker compose -f docker-compose.prod.yml exec -T postgres pg_isready -U "$DB_USER" -d "$DB_NAME" &> /dev/null; then
            log_success "Database is ready"
            break
        fi
        sleep 2
    done
    
    # Run migrations via the app container
    log_info "Applying database schema..."
    docker compose -f docker-compose.prod.yml exec -T app sh -c "cd /app && npm run db:push" 2>/dev/null || \
        log_warn "Migrations may need to be run manually"
    
    log_success "Database setup complete"
}

# =============================================================================
# CREATE SYSTEMD SERVICE
# =============================================================================
create_systemd_service() {
    log_step "Creating systemd service..."
    
    cat > /etc/systemd/system/trackarr.service << EOF
[Unit]
Description=Trackarr P2P Tracker
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.prod.yml down
ExecReload=/usr/bin/docker compose -f docker-compose.prod.yml restart
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
    
    systemctl daemon-reload
    systemctl enable trackarr.service
    
    log_success "Systemd service created and enabled"
}

# =============================================================================
# PRINT SUMMARY
# =============================================================================
print_summary() {
    log_step "Installation Complete!"
    
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║              Trackarr Installation Complete!                   ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Access URLs:${NC}"
    echo -e "  Main Application:  ${CYAN}https://${DOMAIN}${NC}"
    echo -e "  Tracker Announce:  ${CYAN}https://${TRACKER_DOMAIN}${NC}"
    echo -e "  Monitoring:        ${CYAN}https://${MONITORING_DOMAIN}${NC}"
    echo ""
    echo -e "${BOLD}Monitoring Credentials:${NC}"
    echo -e "  Username: ${CYAN}admin${NC}"
    echo -e "  Password: ${CYAN}${MONITORING_PASSWORD}${NC}"
    echo ""
    echo -e "${BOLD}Grafana Credentials:${NC}"
    echo -e "  Username: ${CYAN}admin${NC}"
    echo -e "  Password: ${CYAN}admin${NC} (default)"
    echo -e "  ${YELLOW}⚠️  Change this password at: https://${MONITORING_DOMAIN}/grafana${NC}"
    echo ""
    echo -e "${BOLD}Important Files:${NC}"
    echo -e "  Installation:     ${CYAN}${INSTALL_DIR}${NC}"
    echo -e "  Environment:      ${CYAN}${INSTALL_DIR}/.env${NC}"
    echo -e "  Secrets:          ${CYAN}${INSTALL_DIR}/secrets/${NC}"
    echo ""
    echo -e "${BOLD}Useful Commands:${NC}"
    echo -e "  View logs:        ${CYAN}docker compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "  Restart services: ${CYAN}systemctl restart trackarr${NC}"
    echo -e "  Stop services:    ${CYAN}systemctl stop trackarr${NC}"
    echo -e "  Service status:   ${CYAN}docker compose -f docker-compose.prod.yml ps${NC}"
    echo ""
    echo -e "${YELLOW}${BOLD}⚠️  IMPORTANT SECURITY NOTES:${NC}"
    echo -e "  1. Save the credentials shown above in a secure location"
    echo -e "  2. The secrets in ${INSTALL_DIR}/secrets/ should be backed up securely"
    echo -e "  3. Never commit .env or secrets/ to version control"
    echo -e "  4. Consider rotating secrets quarterly"
    echo ""
    echo -e "${BOLD}Documentation:${NC}"
    echo -e "  ${CYAN}${INSTALL_DIR}/documentation/${NC}"
    echo ""
    
    # Save credentials to a temporary file
    CREDS_FILE="$INSTALL_DIR/CREDENTIALS.txt"
    cat > "$CREDS_FILE" << EOF
================================================================================
Trackarr Installation Credentials
Generated: $(date)
================================================================================

MAIN APPLICATION
URL: https://${DOMAIN}

TRACKER ANNOUNCE
URL: https://${TRACKER_DOMAIN}

MONITORING (Basic Auth)
URL: https://${MONITORING_DOMAIN}
Username: admin
Password: ${MONITORING_PASSWORD}

GRAFANA
URL: https://${MONITORING_DOMAIN}/grafana
Username: admin
Password: admin (default - CHANGE THIS!)

ADMIN API KEY
${ADMIN_API_KEY}

================================================================================
⚠️  DELETE THIS FILE AFTER SAVING CREDENTIALS SECURELY!
================================================================================
EOF
    chmod 600 "$CREDS_FILE"
    
    echo -e "${YELLOW}Credentials saved to: ${CREDS_FILE}${NC}"
    echo ""
    
    # Prompt user to confirm they saved credentials, then delete the file
    echo -e "${BOLD}Have you saved all credentials above to a secure location?${NC}"
    read -p "Type 'yes' to securely delete CREDENTIALS.txt, or press Enter to keep it: " CONFIRM_DELETE
    
    if [[ "$CONFIRM_DELETE" == "yes" ]]; then
        # Secure delete: overwrite with random data before removing
        dd if=/dev/urandom of="$CREDS_FILE" bs=1k count=10 conv=notrunc 2>/dev/null || true
        rm -f "$CREDS_FILE"
        log_success "CREDENTIALS.txt securely deleted"
    else
        echo -e "${RED}${BOLD}⚠️  REMEMBER: Delete CREDENTIALS.txt after saving credentials securely!${NC}"
    fi
    echo ""
}

# =============================================================================
# MAIN INSTALLATION FLOW
# =============================================================================
main() {
    clear
    echo ""
    echo -e "${GREEN}${BOLD}"
    echo "  ┌──────────────────────────────────────────────────────────────────────────┐"
    echo "  │                                                                          │"
    echo "  │      _____ ____      _    ____ _  __    _    ____  ____                  │"
    echo "  │     |_   _|  _ \    / \  / ___| |/ /   / \  |  _ \|  _ \                 │"
    echo "  │       | | | |_) |  / _ \| |   | ' /   / _ \ | |_) | |_) |                │"
    echo "  │       | | |  _ <  / ___ \ |___| . \  / ___ \|  _ <|  _ <                 │"
    echo "  │       |_| |_| \_\/_/   \_\____|_|\_\/_/   \_\_| \_\_| \_\                │"
    echo "  │                                                                          │"
    echo "  │              Production Server Installation Script                       │"
    echo "  │                                                                          │"
    echo "  └──────────────────────────────────────────────────────────────────────────┘"
    echo -e "${NC}"
    echo ""
    
    # Run installation steps
    preflight_checks
    detect_os
    install_dependencies
    install_docker
    configure_firewall
    
    # Check if we're running from the repo directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PARENT_DIR="$(dirname "$SCRIPT_DIR")"
    
    if [[ -f "$PARENT_DIR/docker-compose.prod.yml" ]]; then
        log_info "Running from repository directory"
        INSTALL_DIR="$PARENT_DIR"
    else
        setup_repository
    fi
    
    cd "$INSTALL_DIR"
    
    prompt_configuration
    generate_secrets
    create_env_file
    update_pgbouncer_config
    build_application
    start_services
    run_migrations
    create_systemd_service
    print_summary
}

# =============================================================================
# UNINSTALL FUNCTION
# =============================================================================
uninstall() {
    log_step "Uninstalling Trackarr..."
    
    read -p "Are you sure you want to uninstall Trackarr? This will delete ALL data! (type 'yes' to confirm): " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Uninstall cancelled"
        exit 0
    fi
    
    cd "$INSTALL_DIR" 2>/dev/null || true
    
    # Stop and remove containers
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    
    # Remove Docker image
    docker rmi trackarr:latest 2>/dev/null || true
    
    # Remove systemd service
    systemctl stop trackarr 2>/dev/null || true
    systemctl disable trackarr 2>/dev/null || true
    rm -f /etc/systemd/system/trackarr.service
    systemctl daemon-reload
    
    # Ask about removing installation directory
    read -p "Remove installation directory ($INSTALL_DIR)? (y/N): " REMOVE_DIR
    if [[ $REMOVE_DIR =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
        log_success "Installation directory removed"
    fi
    
    log_success "Trackarr uninstalled"
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================
case "${1:-}" in
    --uninstall|-u)
        uninstall
        ;;
    --help|-h)
        echo "Trackarr Installation Script"
        echo ""
        echo "Usage: $0 [options]"
        echo ""
        echo "Options:"
        echo "  --help, -h        Show this help message"
        echo "  --uninstall, -u   Uninstall Trackarr"
        echo ""
        echo "Environment Variables:"
        echo "  INSTALL_DIR       Installation directory (default: /opt/trackarr)"
        echo "  DOMAIN            Main application domain"
        echo "  TRACKER_DOMAIN    Tracker announce domain"
        echo "  MONITORING_DOMAIN Monitoring dashboard domain"
        echo "  ACME_EMAIL        Email for Let's Encrypt"
        echo "  REPO_URL          Git repository URL"
        echo "  BRANCH            Git branch to checkout (default: main)"
        echo ""
        ;;
    *)
        main
        ;;
esac
