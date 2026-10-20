#!/bin/sh
# Redis Sentinel for a replicated Trackarr deployment (one per site, witness
# included). Sentinel rewrites its config as it learns the topology, so it is
# generated once and kept in the data volume.

set -e

CONF=/data/sentinel.conf

if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<CONF
bind ${NODE_IP} 127.0.0.1
port 26379
protected-mode no
dir /data
sentinel announce-ip ${NODE_IP}
sentinel monitor mymaster ${REDIS_INITIAL_MASTER_IP} 6379 2
sentinel auth-pass mymaster ${REDIS_PASSWORD}
sentinel down-after-milliseconds mymaster ${SENTINEL_DOWN_AFTER_MS:-10000}
sentinel failover-timeout mymaster 60000
sentinel parallel-syncs mymaster 1
CONF
fi

# Clients and the other Sentinels must authenticate: without it, anyone on
# the private network could reconfigure failover (also added to configs
# written by earlier versions)
if ! grep -q '^requirepass ' "$CONF"; then
  echo "requirepass ${REDIS_SENTINEL_PASSWORD}" >> "$CONF"
  echo "sentinel sentinel-pass ${REDIS_SENTINEL_PASSWORD}" >> "$CONF"
fi

# The image's entrypoint hands /data to the redis user and drops root
exec docker-entrypoint.sh redis-server "$CONF" --sentinel
