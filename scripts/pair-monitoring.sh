#!/bin/bash
# =============================================================================
# Trackarr - Pair the Beszel agent
# =============================================================================
# Asks for the public key and token shown by Beszel's "Add system" dialog,
# writes them to .env, enables the monitoring profile and starts the agent.
#
# Usage: sudo ./scripts/pair-monitoring.sh [--local]
#   --local   local production stack (docker-compose.local.yml, .env.local-prod)
#
# Unattended: BESZEL_AGENT_KEY=... BESZEL_AGENT_TOKEN=... ./scripts/pair-monitoring.sh
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok() { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
die() { echo -e "  ${RED}✗${NC} $1" >&2; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"
COMPOSE_FILE="docker-compose.prod.yml"

case "${1:-}" in
    --local)
        COMPOSE_FILE="docker-compose.local.yml"
        ENV_FILE="$PROJECT_DIR/.env.local-prod"
        ;;
    -h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    "") ;;
    *) die "Unknown option: $1 (see --help)" ;;
esac

[[ -f $ENV_FILE ]] || die "$ENV_FILE not found: run the installer first"
COMPOSE=(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE")
LOGS_CMD="${COMPOSE[*]} logs beszel-agent"
[[ -w $ENV_FILE ]] || die "Cannot write $ENV_FILE: run with sudo"
command -v docker >/dev/null || die "Docker is not installed"

# Replace KEY=... (or a commented # KEY=...) in .env, or append it
set_env() {
    local key=$1 value=$2 tmp
    tmp=$(mktemp)
    awk -v k="$key" -v v="$value" '
        $0 ~ "^#? *" k "=" { if (!done) print k "=" v; done = 1; next }
        { print }
        END { if (!done) print k "=" v }
    ' "$ENV_FILE" > "$tmp"
    cat "$tmp" > "$ENV_FILE"
    rm -f "$tmp"
}

current_value() {
    grep -m1 "^$1=" "$ENV_FILE" | cut -d= -f2- || true
}

echo ""
echo -e "  ${BOLD}Trackarr · pair the monitoring agent${NC}"
echo ""
echo "  In Beszel: Add system, host /beszel_socket/beszel.sock, then copy the"
echo "  public key and the token the dialog shows."
echo ""

KEY=${BESZEL_AGENT_KEY:-}
TOKEN=${BESZEL_AGENT_TOKEN:-}
while [[ ! $KEY =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+$ ]]; do
    [[ -n $KEY ]] && warn "That is not a Beszel public key (it starts with ssh-ed25519)"
    read -rp "  Public key: " KEY
    KEY=$(echo "$KEY" | xargs)
done
while [[ ! $TOKEN =~ ^[A-Za-z0-9_-]+$ ]]; do
    [[ -n $TOKEN ]] && warn "That token contains unexpected characters"
    read -rp "  Token: " TOKEN
    TOKEN=$(echo "$TOKEN" | xargs)
done

set_env BESZEL_AGENT_KEY "$KEY"
set_env BESZEL_AGENT_TOKEN "$TOKEN"
profiles=$(current_value COMPOSE_PROFILES)
if [[ ,$profiles, != *,monitoring,* ]]; then
    set_env COMPOSE_PROFILES "${profiles:+$profiles,}monitoring"
fi
ok "Key, token and monitoring profile saved in $ENV_FILE"

cd "$PROJECT_DIR"
"${COMPOSE[@]}" up -d --force-recreate beszel-agent docker-proxy >/dev/null 2>&1 \
    || die "Could not start the agent: $LOGS_CMD"

# The agent exits right away when the key is wrong: give it a moment
sleep 5
if [[ $(docker inspect -f '{{.State.Running}}' trackarr-beszel-agent 2>/dev/null) == true ]]; then
    ok "Agent running"
    echo ""
    echo "  The system turns green in Beszel within a minute. If it does not,"
    echo -e "  check the key and token, then: ${CYAN}${LOGS_CMD}${NC}"
    echo ""
else
    "${COMPOSE[@]}" logs --tail 20 beszel-agent >&2 || true
    die "The agent stopped: check the key and token, then run this script again"
fi
