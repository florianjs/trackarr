#!/bin/bash
# =============================================================================
# Trackarr - Complete Server Installation Script
# =============================================================================
# Installs and configures Trackarr on a fresh server, or updates an existing
# install (secrets, data and monitoring pairing are kept).
# Supports: Ubuntu 20.04+, Debian 11+, CentOS 8+, RHEL 8+, Amazon Linux 2
#
# Usage: sudo ./install.sh [--yes] | --uninstall | --help
# =============================================================================

set -Ee

# =============================================================================
# CONFIGURATION
# =============================================================================
INSTALL_DIR="${INSTALL_DIR:-/opt/trackarr}"
REPO_URL="${REPO_URL:-https://github.com/florianjs/trackarr.git}"
BRANCH="${BRANCH:-main}"
LOG_FILE="${LOG_FILE:-/var/log/trackarr-install.log}"
DOCS_URL="https://florianjs.github.io/trackarr"

# Domain configuration (asked for if not set)
DOMAIN="${DOMAIN:-}"
TRACKER_DOMAIN="${TRACKER_DOMAIN:-}"
MONITORING_DOMAIN="${MONITORING_DOMAIN:-}"
ACME_EMAIL="${ACME_EMAIL:-}"
MONITORING_PASSWORD="${MONITORING_PASSWORD:-}"

# Database defaults
DB_NAME="${DB_NAME:-trackarr}"
DB_USER="${DB_USER:-tracker}"

# --yes, or no terminal to ask on: values come from the environment
ASSUME_YES=false

TOTAL_STEPS=9
STEP=0

# =============================================================================
# OUTPUT
# =============================================================================
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    CYAN='\033[0;36m'
    DIM='\033[2m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' CYAN='' DIM='' BOLD='' NC=''
fi

step() {
    STEP=$((STEP + 1))
    echo -e "\n${CYAN}${BOLD}[${STEP}/${TOTAL_STEPS}]${NC} ${BOLD}$1${NC}"
}
log_info() { echo -e "  ${DIM}•${NC} $1"; }
log_success() { echo -e "  ${GREEN}✓${NC} $1"; }
log_warn() { echo -e "  ${YELLOW}!${NC} $1"; }
log_error() { echo -e "  ${RED}✗${NC} $1" >&2; }
die() {
    log_error "$1"
    exit 1
}

# Runs a command with its output in the log file and a spinner on screen.
# On failure, shows the end of the log and stops the installation.
# The command runs in a subshell: it must not set variables for later steps.
run() {
    local desc=$1
    shift
    echo "=== $(date -u +%T) $desc" >> "$LOG_FILE"
    local status=0
    if [[ -t 1 ]]; then
        "$@" >> "$LOG_FILE" 2>&1 &
        local pid=$! i=0 frames='|/-\'
        while kill -0 "$pid" 2>/dev/null; do
            printf "\r  ${CYAN}%s${NC} %s" "${frames:i++%4:1}" "$desc"
            sleep 0.2
        done
        wait "$pid" || status=$?
        printf "\r\033[K"
    else
        "$@" >> "$LOG_FILE" 2>&1 || status=$?
    fi
    if [[ $status -ne 0 ]]; then
        log_error "$desc failed. Last lines of the log:"
        tail -n 20 "$LOG_FILE" | sed 's/^/      /' >&2
        die "Full log: $LOG_FILE"
    fi
    log_success "$desc"
}

trap 'log_error "Installation stopped (line $LINENO). Log: $LOG_FILE"' ERR

# Yes/no question. In --yes mode the default is the answer.
confirm() {
    local question=$1 default=${2:-n} answer hint="[y/N]"
    [[ $default == y ]] && hint="[Y/n]"
    if [[ $ASSUME_YES == true ]]; then
        [[ $default == y ]]
        return
    fi
    read -rp "  $question $hint " answer
    answer=${answer:-$default}
    [[ $answer =~ ^[Yy] ]]
}

# =============================================================================
# INPUT
# =============================================================================
is_domain() {
    [[ $1 =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,}$ ]]
}

is_email() {
    [[ $1 =~ ^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$ ]]
}

# ask VAR "Label" default validator "error message"
ask() {
    local var=$1 label=$2 default=$3 validator=$4 message=$5 value
    while true; do
        if [[ -n $default ]]; then
            read -rp "  $label [$default]: " value
            value=${value:-$default}
        else
            read -rp "  $label: " value
        fi
        value=${value// /}
        if [[ -z $value ]]; then
            log_error "Required"
        elif ! $validator "$value"; then
            log_error "$message"
        else
            printf -v "$var" '%s' "$value"
            return
        fi
    done
}

# Value from an existing .env (always succeeds: a missing .env must not
# abort under set -e)
existing_value() {
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        grep -m1 "^$1=" "$INSTALL_DIR/.env" | cut -d= -f2- || true
    fi
}

random_string() {
    tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$1" || true
}

# =============================================================================
# PREFLIGHT CHECKS
# =============================================================================
preflight_checks() {
    step "Checking the server"

    [[ $EUID -eq 0 ]] || die "Run this script as root: sudo $0"
    { : > "$LOG_FILE"; } 2>/dev/null || LOG_FILE=/tmp/trackarr-install.log
    chmod 600 "$LOG_FILE" 2>/dev/null || true

    detect_os

    local ram disk
    ram=$(awk '/^MemTotal:/ {print int($2 / 1024)}' /proc/meminfo)
    disk=$(df -BG / | awk 'NR==2 {print $4}' | tr -d 'G')
    if [[ $ram -lt 1500 ]]; then
        log_warn "${ram} MB of RAM: 2 GB recommended, Trackarr may run slowly"
        confirm "Continue anyway?" n || exit 1
    else
        log_success "RAM: ${ram} MB"
    fi
    if [[ $disk -lt 10 ]]; then
        log_warn "${disk} GB of free disk: 10 GB recommended"
        confirm "Continue anyway?" n || exit 1
    else
        log_success "Free disk: ${disk} GB"
    fi

    # Caddy needs 80 and 443 for the certificates (Docker's own proxy is
    # fine: that is an earlier Trackarr install being updated)
    if command -v ss &> /dev/null; then
        local busy
        busy=$(ss -Hltnp 2>/dev/null | awk '$4 ~ /:(80|443)$/' | grep -v docker-proxy || true)
        if [[ -n $busy ]]; then
            log_warn "Ports 80/443 are already used by another program:"
            echo "$busy" | sed 's/^/      /'
            confirm "Continue anyway? (Caddy will fail to start)" n || exit 1
        else
            log_success "Ports 80 and 443 free"
        fi
    fi
}

detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    elif [[ -f /etc/redhat-release ]]; then
        OS="centos"
        VERSION=$(grep -oE '[0-9]+' /etc/redhat-release | head -1)
    else
        die "Unable to detect the operating system"
    fi

    case $OS in
        ubuntu|debian)
            PKG_UPDATE="apt-get update -qq"
            PKG_INSTALL="apt-get install -y -qq"
            ;;
        centos|rhel|fedora|rocky|almalinux)
            PKG_UPDATE="dnf check-update || true"
            PKG_INSTALL="dnf install -y -q"
            ;;
        amzn)
            PKG_UPDATE="yum check-update || true"
            PKG_INSTALL="yum install -y -q"
            ;;
        *)
            die "Unsupported operating system: $OS (Ubuntu, Debian, CentOS, RHEL, Rocky, Alma, Fedora, Amazon Linux)"
            ;;
    esac
    log_success "System: ${PRETTY_NAME:-$OS $VERSION}"
}

# The SSH port in use, so the firewall never locks the admin out
detect_ssh_port() {
    SSH_PORT=$(sshd -T 2>/dev/null | awk '/^port / {print $2; exit}' || true)
    SSH_PORT=${SSH_PORT:-22}
}

# =============================================================================
# CONFIGURATION QUESTIONS
# =============================================================================
prompt_configuration() {
    step "Configuration"

    # Re-run: the previous answers are the defaults
    KEEP_MONITORING_HASH=""
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        log_info "Existing install in $INSTALL_DIR: its settings are the defaults"
        DOMAIN=${DOMAIN:-$(existing_value DOMAIN)}
        TRACKER_DOMAIN=${TRACKER_DOMAIN:-$(existing_value TRACKER_DOMAIN)}
        MONITORING_DOMAIN=${MONITORING_DOMAIN:-$(existing_value MONITORING_DOMAIN)}
        ACME_EMAIL=${ACME_EMAIL:-$(existing_value ACME_EMAIL)}
        # Stored with $ doubled for Docker Compose
        KEEP_MONITORING_HASH=$(existing_value MONITORING_PASSWORD_HASH | sed 's/\$\$/$/g')
    fi

    if [[ $ASSUME_YES == true ]]; then
        [[ -n $DOMAIN ]] || die "DOMAIN is required with --yes (e.g. DOMAIN=example.com)"
        [[ -n $ACME_EMAIL ]] || die "ACME_EMAIL is required with --yes"
        TRACKER_DOMAIN=${TRACKER_DOMAIN:-announce.$DOMAIN}
        MONITORING_DOMAIN=${MONITORING_DOMAIN:-monitoring.$DOMAIN}
        local name
        for name in "$DOMAIN" "$TRACKER_DOMAIN" "$MONITORING_DOMAIN"; do
            is_domain "$name" || die "Not a valid domain: $name"
        done
        is_email "$ACME_EMAIL" || die "Not a valid email: $ACME_EMAIL"
    else
        echo ""
        echo -e "  ${DIM}These names must point to this server (DNS A/AAAA records): Caddy${NC}"
        echo -e "  ${DIM}needs them for the HTTPS certificates. Press Enter to keep a default.${NC}"
        echo ""
        ask DOMAIN "Website domain (e.g. example.com)" "$DOMAIN" is_domain "Not a valid domain name"
        ask TRACKER_DOMAIN "Tracker (announce) domain" "${TRACKER_DOMAIN:-announce.$DOMAIN}" is_domain "Not a valid domain name"
        ask MONITORING_DOMAIN "Monitoring domain" "${MONITORING_DOMAIN:-monitoring.$DOMAIN}" is_domain "Not a valid domain name"
        ask ACME_EMAIL "Email for Let's Encrypt (expiry notices)" "$ACME_EMAIL" is_email "Not a valid email address"
        if [[ -z $MONITORING_PASSWORD ]]; then
            if [[ -n $KEEP_MONITORING_HASH ]]; then
                read -rsp "  Monitoring password (Enter to keep the current one): " MONITORING_PASSWORD
            else
                read -rsp "  Monitoring password (Enter to generate one): " MONITORING_PASSWORD
            fi
            echo ""
        fi
    fi

    GENERATED_MONITORING_PASSWORD=false
    if [[ -n $MONITORING_PASSWORD ]]; then
        KEEP_MONITORING_HASH=""
    elif [[ -z $KEEP_MONITORING_HASH ]]; then
        MONITORING_PASSWORD=$(random_string 16)
        GENERATED_MONITORING_PASSWORD=true
    fi

    check_dns
}

# Let's Encrypt fails when a name does not point here: say so now, not
# after a ten-minute build
check_dns() {
    command -v getent &> /dev/null || return 0
    local public_ip name resolved problems=0
    public_ip=$(curl -fsS4 --max-time 5 https://api.ipify.org 2>/dev/null || true)
    echo ""
    for name in "$DOMAIN" "$TRACKER_DOMAIN" "$MONITORING_DOMAIN"; do
        resolved=$(getent ahostsv4 "$name" 2>/dev/null | awk 'NR==1 {print $1}' || true)
        if [[ -z $resolved ]]; then
            log_warn "$name does not resolve yet"
            problems=$((problems + 1))
        elif [[ -n $public_ip && $resolved != "$public_ip" ]]; then
            log_warn "$name points to $resolved, but this server is $public_ip"
            problems=$((problems + 1))
        else
            log_success "$name → $resolved"
        fi
    done
    if [[ $problems -gt 0 ]]; then
        log_info "HTTPS works once these records point here (Caddy keeps retrying)"
        confirm "Continue anyway?" y || exit 1
    fi
}

# What is about to happen, before anything is changed
confirm_plan() {
    local secrets="generated" password="generated (shown at the end)"
    [[ -f "$INSTALL_DIR/.env" ]] && secrets="kept from the existing .env"
    [[ -n $KEEP_MONITORING_HASH ]] && password="unchanged"
    [[ $GENERATED_MONITORING_PASSWORD != true && -n $MONITORING_PASSWORD ]] && password="the one you entered"
    echo ""
    echo -e "  ${BOLD}Summary${NC}"
    echo -e "    Website              ${CYAN}https://${DOMAIN}${NC}"
    echo -e "    Announce URL         ${CYAN}https://${TRACKER_DOMAIN}/announce${NC}"
    echo -e "    Monitoring           ${CYAN}https://${MONITORING_DOMAIN}${NC} (password: ${password})"
    echo -e "    Let's Encrypt email  ${ACME_EMAIL}"
    echo -e "    Directory            ${INSTALL_DIR}"
    echo -e "    Secrets              ${secrets}"
    echo -e "    Firewall             allow SSH (port ${SSH_PORT}), HTTP and HTTPS only"
    echo ""
    log_info "Next: install Docker if needed, build Trackarr (5-10 minutes) and start it."
    confirm "Proceed?" y || { log_info "Nothing was changed"; exit 0; }
}

# =============================================================================
# INSTALL SYSTEM DEPENDENCIES AND DOCKER
# =============================================================================
install_dependencies() {
    step "Installing Docker and system packages"

    run "Updating package lists" bash -c "$PKG_UPDATE"
    case $OS in
        ubuntu|debian)
            run "Installing curl, git and openssl" $PKG_INSTALL curl wget git openssl ca-certificates gnupg lsb-release
            ;;
        centos|rhel|fedora|rocky|almalinux)
            run "Installing curl, git and openssl" $PKG_INSTALL curl wget git openssl ca-certificates
            ;;
        amzn)
            run "Installing curl, git and openssl" $PKG_INSTALL curl wget git openssl
            ;;
    esac

    if command -v docker &> /dev/null && docker compose version &> /dev/null; then
        log_success "Docker $(docker --version | awk '{print $3}' | tr -d ',') already installed"
        return 0
    fi
    run "Installing Docker" install_docker
    run "Starting Docker" systemctl enable --now docker
}

install_docker() {
    case $OS in
        ubuntu|debian)
            # Remove old versions
            apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true

            # Add Docker's official GPG key
            install -m 0755 -d /etc/apt/keyrings
            curl -fsSL "https://download.docker.com/linux/$OS/gpg" | gpg --dearmor --yes -o /etc/apt/keyrings/docker.gpg
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
}

# =============================================================================
# CONFIGURE FIREWALL
# =============================================================================
configure_firewall() {
    step "Configuring the firewall"

    if command -v ufw &> /dev/null; then
        # Rules first, then enable: SSH stays reachable throughout
        run "Allowing SSH (port $SSH_PORT), HTTP and HTTPS" bash -c \
            "ufw allow $SSH_PORT/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp"
        run "Enabling ufw" ufw --force enable
        return 0
    fi

    if command -v firewall-cmd &> /dev/null && systemctl is-active firewalld &> /dev/null; then
        run "Allowing SSH (port $SSH_PORT), HTTP and HTTPS" bash -c \
            "firewall-cmd --permanent --add-port=$SSH_PORT/tcp && firewall-cmd --permanent --add-service=http && firewall-cmd --permanent --add-service=https && firewall-cmd --permanent --add-port=443/udp && firewall-cmd --reload"
        return 0
    fi

    log_warn "No firewall found (ufw or firewalld): allow only SSH, 80 and 443 yourself"
}

# =============================================================================
# CLONE OR UPDATE REPOSITORY
# =============================================================================
setup_repository() {
    step "Getting Trackarr"

    if [[ -n $RUNNING_FROM_REPO ]]; then
        log_success "Using this copy: $INSTALL_DIR"
    elif [[ -d "$INSTALL_DIR/.git" ]]; then
        cd "$INSTALL_DIR"
        run "Updating $INSTALL_DIR ($BRANCH)" bash -c "git fetch origin && git checkout '$BRANCH' && git pull origin '$BRANCH'"
    elif [[ -d "$INSTALL_DIR" ]] && [[ "$(ls -A "$INSTALL_DIR")" ]]; then
        # Check if Dockerfile exists (valid installation)
        if [[ -f "$INSTALL_DIR/Dockerfile" ]]; then
            log_success "Using the copy in $INSTALL_DIR"
        else
            log_warn "$INSTALL_DIR exists, is not empty and holds no Trackarr install."
            [[ $ASSUME_YES != true ]] || die "Choose another INSTALL_DIR or empty this one"
            local reclone
            read -rp "  Delete everything in $INSTALL_DIR and download Trackarr there? (type 'yes'): " reclone
            [[ $reclone == "yes" ]] || die "Aborted: choose another INSTALL_DIR or empty this one"
            rm -rf "$INSTALL_DIR"
            run "Downloading Trackarr ($BRANCH)" git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
        fi
    else
        run "Downloading Trackarr ($BRANCH)" git clone --branch "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"
}

# =============================================================================
# SECRETS AND ENVIRONMENT FILE
# =============================================================================
generate_secrets() {
    step "Preparing secrets and configuration"

    SECRETS_DIR="$INSTALL_DIR/secrets"
    mkdir -p "$SECRETS_DIR"
    chmod 700 "$SECRETS_DIR"

    # Re-running on an existing install keeps its secrets: new ones would no
    # longer open the database, and would void every session and IP hash
    REUSED_SECRETS=false
    if [[ -f "$INSTALL_DIR/.env" ]]; then
        REUSED_SECRETS=true
    fi

    # Database password (32 chars, alphanumeric)
    DB_PASSWORD=$(existing_value DB_PASSWORD)
    [[ -z "$DB_PASSWORD" ]] && DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    echo -n "$DB_PASSWORD" > "$SECRETS_DIR/db_password.txt"

    # Redis password (32 chars)
    REDIS_PASSWORD=$(existing_value REDIS_PASSWORD)
    [[ -z "$REDIS_PASSWORD" ]] && REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    echo -n "$REDIS_PASSWORD" > "$SECRETS_DIR/redis_password.txt"

    # IP hash secret (64 chars)
    IP_HASH_SECRET=$(existing_value IP_HASH_SECRET)
    [[ -z "$IP_HASH_SECRET" ]] && IP_HASH_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
    echo -n "$IP_HASH_SECRET" > "$SECRETS_DIR/ip_hash_secret.txt"

    # Token between the app and the tracker service's private API (64 chars)
    TRACKER_INTERNAL_TOKEN=$(existing_value TRACKER_INTERNAL_TOKEN)
    [[ -z "$TRACKER_INTERNAL_TOKEN" ]] && TRACKER_INTERNAL_TOKEN=$(openssl rand -hex 32)
    echo -n "$TRACKER_INTERNAL_TOKEN" > "$SECRETS_DIR/tracker_internal_token.txt"

    # Nuxt session secret (64 chars)
    NUXT_SESSION_SECRET=$(existing_value NUXT_SESSION_SECRET)
    [[ -z "$NUXT_SESSION_SECRET" ]] && NUXT_SESSION_SECRET=$(openssl rand -base64 64 | tr -d '/+=' | head -c 64)
    echo -n "$NUXT_SESSION_SECRET" > "$SECRETS_DIR/nuxt_session_secret.txt"

    chmod 600 "$SECRETS_DIR"/*
    if [[ $REUSED_SECRETS == true ]]; then
        log_success "Secrets kept from the existing .env"
    else
        log_success "Secrets generated in $SECRETS_DIR"
    fi

    # Caddy's basic auth hash, the password going through stdin (never in
    # the process list)
    if [[ -n $KEEP_MONITORING_HASH ]]; then
        MONITORING_PASSWORD_HASH=$KEEP_MONITORING_HASH
    else
        run "Downloading Caddy" docker pull -q caddy:2-alpine
        MONITORING_PASSWORD_HASH=$(printf '%s\n' "$MONITORING_PASSWORD" | docker run --rm -i caddy:2-alpine caddy hash-password 2>>"$LOG_FILE") \
            || die "Could not hash the monitoring password (see $LOG_FILE)"
    fi

    create_env_file
}

create_env_file() {
    ENV_FILE="$INSTALL_DIR/.env"

    # Beszel agent pairing survives a re-run
    local key token
    key=$(existing_value BESZEL_AGENT_KEY)
    token=$(existing_value BESZEL_AGENT_TOKEN)
    MONITORING_PAIRED=false
    if [[ -n "$key" ]]; then
        MONITORING_PAIRED=true
        BESZEL_ENV=$(printf 'BESZEL_AGENT_KEY=%s\nBESZEL_AGENT_TOKEN=%s\nCOMPOSE_PROFILES=monitoring' "$key" "$token")
    else
        BESZEL_ENV=$(printf '# BESZEL_AGENT_KEY=\n# BESZEL_AGENT_TOKEN=\n# COMPOSE_PROFILES=monitoring')
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
IP_HASH_SECRET=${IP_HASH_SECRET}
TRACKER_INTERNAL_TOKEN=${TRACKER_INTERNAL_TOKEN}

# Domains
DOMAIN=${DOMAIN}
TRACKER_DOMAIN=${TRACKER_DOMAIN}
MONITORING_DOMAIN=${MONITORING_DOMAIN}
ACME_EMAIL=${ACME_EMAIL}

# Tracker Announce URLs (displayed in admin dashboard)
TRACKER_HTTP_URL=https://${TRACKER_DOMAIN}/announce

# Monitoring
MONITORING_USER=admin
# Note: $ escaped as $$ for Docker Compose compatibility
MONITORING_PASSWORD_HASH=$(echo "${MONITORING_PASSWORD_HASH}" | sed 's/\$/\$\$/g')
# Beszel agent, once paired in the monitoring UI (see the Monitoring guide)
${BESZEL_ENV}
EOF

    chmod 600 "$ENV_FILE"
    log_success "Configuration written to $ENV_FILE"
}

# =============================================================================
# BUILD AND START
# =============================================================================
build_application() {
    step "Building Trackarr"

    cd "$INSTALL_DIR"
    # Build through compose so the tracker URLs from .env are passed as build
    # args (a plain docker build baked localhost into the image, issue #49)
    run "Building the app and tracker images (5-10 minutes)" docker compose -f docker-compose.prod.yml build app tracker
}

start_services() {
    step "Starting Trackarr"

    cd "$INSTALL_DIR"

    # Existing database volume: with reused secrets it is simply this install
    # being updated. Without them its credentials may not match; deleting it
    # destroys every user and torrent, so it is never the default.
    if [[ "$REUSED_SECRETS" != "true" ]] && docker volume ls -q | grep -q "trackarr_postgres_data"; then
        log_warn "A database from an earlier install exists, but not the .env with its password"
        echo "      1) Keep it (default; restore the matching .env to use it)"
        echo "      2) DELETE all existing data and start fresh"
        local choice=1 confirm_delete
        if [[ $ASSUME_YES != true ]]; then
            read -rp "  Choose 1 or 2 [1]: " choice
            if [[ "$choice" == "2" ]]; then
                read -rp "  Type 'delete' to confirm that ALL data will be lost: " confirm_delete
                [[ "$confirm_delete" == "delete" ]] || choice=1
            fi
        fi

        if [[ "$choice" == "2" ]]; then
            run "Removing the old data" bash -c "docker compose -f docker-compose.prod.yml down -v || true"
        else
            log_warn "Keeping the old database: its password must match .env"
        fi
    fi

    run "Starting the containers" docker compose -f docker-compose.prod.yml up -d
    prepare_database
    run "Waiting for Trackarr to answer" wait_for_app
}

# The app container turns healthy once migrations ran and it serves requests
wait_for_app() {
    local status
    for _ in $(seq 1 90); do
        status=$(docker inspect --format '{{.State.Health.Status}}' trackarr-app 2>/dev/null || true)
        [[ $status == healthy ]] && return 0
        sleep 2
    done
    echo "trackarr-app is still '$status' after 3 minutes"
    docker compose -f docker-compose.prod.yml ps
    docker compose -f docker-compose.prod.yml logs --tail 50 app
    return 1
}

# Installs from before the rename used a database called "opentracker"
prepare_database() {
    local compose="docker compose -f docker-compose.prod.yml"
    local ready=false
    for _ in $(seq 1 30); do
        if $compose exec -T postgres pg_isready -U "$DB_USER" -d postgres &> /dev/null; then
            ready=true
            break
        fi
        sleep 2
    done
    [[ $ready == true ]] || die "PostgreSQL did not start ($compose logs postgres)"

    local psql=(docker compose -f docker-compose.prod.yml exec -T -e PGPASSWORD="$DB_PASSWORD" postgres psql -U "$DB_USER" -d postgres)
    if "${psql[@]}" -lqt | cut -d \| -f 1 | grep -qw "$DB_NAME"; then
        log_success "Database '$DB_NAME' ready"
    elif "${psql[@]}" -lqt | cut -d \| -f 1 | grep -qw "opentracker"; then
        "${psql[@]}" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'opentracker';" > /dev/null 2>&1 || true
        run "Renaming the legacy 'opentracker' database to '$DB_NAME'" "${psql[@]}" -c "ALTER DATABASE opentracker RENAME TO \"$DB_NAME\";"
    else
        run "Creating the '$DB_NAME' database" "${psql[@]}" -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"
    fi
}

# =============================================================================
# CREATE SYSTEMD SERVICE
# =============================================================================
create_systemd_service() {
    step "Starting Trackarr with the server"

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

    run "Enabling the trackarr service" bash -c "systemctl daemon-reload && systemctl enable trackarr.service"
}

# =============================================================================
# PRINT SUMMARY
# =============================================================================
print_summary() {
    echo ""
    echo -e "${GREEN}${BOLD}  ✓ Trackarr is running${NC}"
    echo ""
    echo -e "  ${BOLD}Addresses${NC}"
    echo -e "    Website       ${CYAN}https://${DOMAIN}${NC}"
    echo -e "    Announce URL  ${CYAN}https://${TRACKER_DOMAIN}/announce${NC}"
    echo -e "    Monitoring    ${CYAN}https://${MONITORING_DOMAIN}${NC}"
    echo ""
    echo -e "  ${BOLD}Monitoring login${NC} (browser prompt)"
    echo -e "    User          ${CYAN}admin${NC}"
    if [[ -n $KEEP_MONITORING_HASH ]]; then
        echo -e "    Password      unchanged"
    else
        echo -e "    Password      ${CYAN}${MONITORING_PASSWORD}${NC}"
    fi
    echo ""
    echo -e "  ${BOLD}Next steps${NC}"
    if [[ $REUSED_SECRETS == true ]]; then
        echo -e "    1. Open ${CYAN}https://${DOMAIN}${NC}: accounts and data are unchanged."
    else
        echo -e "    1. Open ${CYAN}https://${DOMAIN}${NC} and register: the first account becomes the admin."
    fi
    if [[ $MONITORING_PAIRED == true ]]; then
        echo -e "    2. Monitoring is paired and running."
    else
        echo -e "    2. Open ${CYAN}https://${MONITORING_DOMAIN}${NC} now: the first visitor creates the"
        echo -e "       Beszel admin. Then pair this server: ${CYAN}${DOCS_URL}/guide/monitoring${NC}"
    fi
    echo ""
    echo -e "  ${BOLD}Useful commands${NC} (in ${INSTALL_DIR})"
    echo -e "    Logs          ${CYAN}docker compose -f docker-compose.prod.yml logs -f${NC}"
    echo -e "    Status        ${CYAN}docker compose -f docker-compose.prod.yml ps${NC}"
    echo -e "    Restart       ${CYAN}systemctl restart trackarr${NC}"
    echo -e "    Update        ${CYAN}sudo ./scripts/install.sh${NC} (keeps secrets, data and pairing)"
    echo ""
    echo -e "  ${YELLOW}!${NC} Back up ${BOLD}${INSTALL_DIR}/.env${NC} and ${BOLD}${INSTALL_DIR}/secrets/${NC}: without them"
    echo -e "    the database cannot be opened."
    echo -e "  ${DIM}Docs: ${DOCS_URL} · Install log: ${LOG_FILE}${NC}"
    echo ""

    # A generated password is shown once, nowhere else
    if [[ $GENERATED_MONITORING_PASSWORD == true && $ASSUME_YES != true ]]; then
        read -rp "  Press Enter once the monitoring password is saved... " _
    fi
}

# =============================================================================
# MAIN INSTALLATION FLOW
# =============================================================================
main() {
    echo ""
    echo -e "  ${GREEN}${BOLD}Trackarr${NC} ${DIM}· server installation${NC}"

    # Run from a checkout: install in place
    local script_dir parent_dir
    script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    parent_dir="$(dirname "$script_dir")"
    RUNNING_FROM_REPO=""
    if [[ -f "$parent_dir/docker-compose.prod.yml" ]]; then
        INSTALL_DIR="$parent_dir"
        RUNNING_FROM_REPO=1
    fi

    # Every question first, then it runs unattended
    preflight_checks
    detect_ssh_port
    prompt_configuration
    confirm_plan

    install_dependencies
    configure_firewall
    setup_repository
    generate_secrets
    build_application
    start_services
    create_systemd_service
    print_summary
}

# =============================================================================
# UNINSTALL FUNCTION
# =============================================================================
uninstall() {
    [[ $EUID -eq 0 ]] || die "Run this script as root: sudo $0 --uninstall"
    echo ""
    log_warn "This deletes Trackarr's containers and ALL its data (users, torrents, database)."
    local confirm_uninstall remove_dir
    read -rp "  Type 'yes' to uninstall: " confirm_uninstall
    if [[ "$confirm_uninstall" != "yes" ]]; then
        log_info "Uninstall cancelled"
        exit 0
    fi

    cd "$INSTALL_DIR" 2>/dev/null || true

    # Stop and remove containers
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    log_success "Containers and volumes removed"

    # Remove Docker images
    docker rmi trackarr:latest trackarr-tracker:latest 2>/dev/null || true

    # Remove systemd service
    systemctl stop trackarr 2>/dev/null || true
    systemctl disable trackarr 2>/dev/null || true
    rm -f /etc/systemd/system/trackarr.service
    systemctl daemon-reload
    log_success "Service removed"

    # Ask about removing installation directory
    read -rp "  Also delete $INSTALL_DIR (configuration and secrets)? [y/N] " remove_dir
    if [[ $remove_dir =~ ^[Yy]$ ]]; then
        rm -rf "$INSTALL_DIR"
        log_success "$INSTALL_DIR deleted"
    fi

    log_success "Trackarr uninstalled"
}

usage() {
    cat << EOF
Trackarr installation script

Usage: sudo $0 [options]

Options:
  -y, --yes         No questions: values come from the environment
                    (DOMAIN and ACME_EMAIL are required)
  -u, --uninstall   Remove Trackarr and its data
  -h, --help        Show this help

Environment variables:
  DOMAIN              Website domain
  TRACKER_DOMAIN      Tracker announce domain (default: announce.DOMAIN)
  MONITORING_DOMAIN   Monitoring domain (default: monitoring.DOMAIN)
  ACME_EMAIL          Email for Let's Encrypt
  MONITORING_PASSWORD Monitoring password (default: kept, or generated)
  INSTALL_DIR         Installation directory (default: /opt/trackarr)
  REPO_URL            Git repository URL
  BRANCH              Git branch to check out (default: main)
  LOG_FILE            Detailed log (default: /var/log/trackarr-install.log)
  NO_COLOR            Disable colors

Running it again updates the install and keeps its secrets, data and
monitoring pairing. Docs: ${DOCS_URL}
EOF
}

# =============================================================================
# SCRIPT ENTRY POINT
# =============================================================================
# Sourced (tests): define the functions only
[[ "${BASH_SOURCE[0]}" != "$0" ]] && return 0

case "${1:-}" in
    --uninstall|-u)
        uninstall
        ;;
    --help|-h)
        usage
        ;;
    --yes|-y)
        ASSUME_YES=true
        main
        ;;
    "")
        # No terminal to ask on (e.g. piped into bash): behave as --yes
        [[ -t 0 ]] || ASSUME_YES=true
        main
        ;;
    *)
        usage
        exit 1
        ;;
esac
