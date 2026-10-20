#!/bin/sh
# Turn on etcd authentication (idempotent, runs on every site, any order).
# Without it, anyone on the private network could rewrite Patroni's leader
# key and promote a second primary. Patroni gets a user limited to its keys.

set -e

export ETCDCTL_ENDPOINTS="http://${NODE_IP}:2379"
ROOT="--user=root:${ETCD_ROOT_PASSWORD}"

echo "[etcd-auth] Waiting for etcd..."
until etcdctl endpoint health >/dev/null 2>&1 || etcdctl "$ROOT" endpoint health >/dev/null 2>&1; do
  sleep 2
done

if etcdctl "$ROOT" auth status 2>/dev/null | grep -q 'Authentication Status: true'; then
  echo "[etcd-auth] Already enabled"
  exit 0
fi

# Another site may enable auth between two of these calls: ignore failures
# here, the final check decides
etcdctl user add root --new-user-password="${ETCD_ROOT_PASSWORD}" >/dev/null 2>&1 || true
etcdctl user add patroni --new-user-password="${ETCD_PATRONI_PASSWORD}" >/dev/null 2>&1 || true
etcdctl role add patroni >/dev/null 2>&1 || true
etcdctl role grant-permission patroni --prefix=true readwrite /service/ >/dev/null 2>&1 || true
etcdctl user grant-role patroni patroni >/dev/null 2>&1 || true
etcdctl auth enable >/dev/null 2>&1 || true

etcdctl "$ROOT" auth status | grep -q 'Authentication Status: true'
echo "[etcd-auth] Enabled"
