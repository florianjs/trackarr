#!/bin/sh
# Redis for a replicated Trackarr node.
# The config lives in the data volume: after a failover Sentinel rewrites it
# (replicaof ...), and a restarted node must keep that role, not the initial one.

set -e

CONF=/data/redis.conf

if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<EOF
bind ${NODE_IP} 127.0.0.1
port 6379
protected-mode no
requirepass ${REDIS_PASSWORD}
masterauth ${REDIS_PASSWORD}
appendonly yes
dir /data
replica-announce-ip ${NODE_IP}
EOF
  # Every node but the initial master starts as a replica
  if [ "${NODE_IP}" != "${REDIS_INITIAL_MASTER_IP}" ]; then
    echo "replicaof ${REDIS_INITIAL_MASTER_IP} 6379" >> "$CONF"
  fi
fi

exec redis-server "$CONF"
