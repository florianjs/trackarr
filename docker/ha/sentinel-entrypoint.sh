#!/bin/sh
# Redis Sentinel for a replicated Trackarr deployment (one per site, witness
# included). Sentinel rewrites its config as it learns the topology, so it is
# generated once and kept in the data volume.

set -e

CONF=/data/sentinel.conf

if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<EOF
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
EOF
fi

exec redis-sentinel "$CONF"
