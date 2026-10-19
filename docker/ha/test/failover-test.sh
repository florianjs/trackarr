#!/bin/sh
# End-to-end failover test on one machine (see compose.yml next to this file).
#   1. start three sites, write data through dc1 (tracker announces)
#   2. cut dc1 off the network (datacenter outage)
#   3. check dc2 takes over: Postgres primary, Redis master, app writes
#   4. reconnect dc1 and check it rejoins as a replica
# Requires the images:
#   docker build -t trackarr:ha-test .
#   docker build -t trackarr-tracker:ha-test tracker

set -eu

cd "$(dirname "$0")"
DC="docker compose -f compose.yml"
SUPER="postgres://postgres:test-super@127.0.0.1:5432"

log() { printf '\n\033[1m[%s] %s\033[0m\n' "$(date +%T)" "$*"; }
fail() { printf '\033[31mFAIL: %s\033[0m\n' "$*"; exit 1; }

# psql against the current primary, from inside a Postgres site
sql() { $DC exec -T "$1" psql "$SUPER/trackarr" -qAtc "$2"; }

wait_for() { # description, timeout seconds, command...
  desc=$1; timeout=$2; shift 2
  start=$(date +%s)
  until "$@" >/dev/null 2>&1; do
    [ $(( $(date +%s) - start )) -ge "$timeout" ] && fail "$desc (after ${timeout}s)"
    sleep 1
  done
  echo "  ok: $desc ($(( $(date +%s) - start ))s)"
}

# Announces are processed after the response: poll for the credited upload
uploaded_is() { [ "$(sql "$1" "SELECT uploaded FROM users WHERE id='u-seed'")" = "$2" ]; }
is_leader() { $DC exec -T "$1" curl -sf "http://$2:8008/primary"; }
healthy() { curl -sf -m 5 "http://127.0.0.1:$1/api/health"; }
# The tracker answers announces once it has read its settings from Postgres
tracker_up() { curl -sf -m 5 "http://127.0.0.1:$1/announce" | grep -q 'failure reason'; }
redis_master_is() {
  [ "$($DC exec -T sentinel2 redis-cli -p 26379 sentinel get-master-addr-by-name mymaster | head -1)" = "$1" ]
}

# info_hash / peer_id as URL-encoded raw bytes
HASH=aabbccddeeff00112233445566778899aabbccdd
enc() { echo "$1" | sed 's/../%&/g'; }
announce() { # port, passkey, peer_id(hex 40), uploaded, left, event
  curl -sf -m 10 -H 'X-Forwarded-For: 192.0.2.10' \
    "http://127.0.0.1:$1/announce?info_hash=$(enc $HASH)&peer_id=$(enc "$3")&port=6881&uploaded=$4&downloaded=0&left=$5&event=$6&passkey=$2&compact=1" \
    | grep -q 'interval' || fail "announce on :$1 rejected"
}
SEEDER_PEER=1111111111111111111111111111111111111111
LEECH_PEER=2222222222222222222222222222222222222222

log "Starting three sites"
$DC down -v --remove-orphans >/dev/null 2>&1 || true
$DC up -d site1 site2 site3 etcd1 etcd2 etcd3 sentinel1 sentinel2 sentinel3 redis1 redis2 pg1
# First node up bootstraps the cluster: start dc1 alone, then dc2 joins it
wait_for "Postgres primary elected on dc1" 180 is_leader pg1 172.30.8.1
$DC up -d pg2
wait_for "dc2 replica streaming" 180 sh -c "$DC exec -T pg1 patronictl list | grep -E 'Replica|Sync' | grep -q streaming"

log "Starting the app and the tracker on both app sites"
$DC up -d app1 app2 tracker1 tracker2
wait_for "app1 healthy" 240 healthy 3001
wait_for "app2 healthy" 240 healthy 3002
wait_for "tracker1 up" 60 tracker_up 8081
wait_for "tracker2 up" 60 tracker_up 8082

log "Seeding a seeder, a leecher and an approved torrent"
sql pg1 "INSERT INTO users (id, username, passkey) VALUES
  ('u-seed', 'seeder', 'pkseed00000000000000000000000000'),
  ('u-leech', 'leecher', 'pkleech0000000000000000000000000');
  INSERT INTO torrents (id, info_hash, name, size, is_approved, uploader_id)
  VALUES ('t1', '$HASH', 'ha-test', 1000000000, true, 'u-seed');"

log "Writes through dc1"
announce 8081 pkleech0000000000000000000000000 $LEECH_PEER 0 1000000000 started
announce 8081 pkseed00000000000000000000000000 $SEEDER_PEER 0 0 started
sleep 3
announce 8081 pkseed00000000000000000000000000 $SEEDER_PEER 1048576 0 update
wait_for "1 MiB credited through dc1" 10 uploaded_is pg1 1048576

log "Datacenter dc1 goes dark"
T0=$(date +%s)
docker network disconnect trackarr-ha-test_wan "$($DC ps -q site1)"
docker network disconnect trackarr-ha-test_wan "$($DC ps -q app1)"
docker network disconnect trackarr-ha-test_wan "$($DC ps -q tracker1)"
wait_for "dc2 promoted to Postgres primary" 120 is_leader pg2 172.30.8.2
wait_for "Sentinel promoted Redis on dc2" 120 redis_master_is 172.30.8.2
wait_for "app2 healthy on the new primaries" 120 healthy 3002
echo "  failover took $(( $(date +%s) - T0 ))s"

log "Writes through dc2"
# Swarms live in each tracker's memory: dc2 rebuilds them from re-announces.
# Its first announce per peer sets the baseline (nothing credited), the next
# one credits the difference.
sleep 3
announce 8082 pkleech0000000000000000000000000 $LEECH_PEER 0 1000000000 update
announce 8082 pkseed00000000000000000000000000 $SEEDER_PEER 2097152 0 update
sleep 3
announce 8082 pkseed00000000000000000000000000 $SEEDER_PEER 3145728 0 update
wait_for "next 1 MiB credited through dc2" 10 uploaded_is pg2 2097152

log "dc1 comes back"
docker network connect --ip 172.30.8.1 trackarr-ha-test_wan "$($DC ps -q site1)"
docker network connect --ip 172.30.8.11 trackarr-ha-test_wan "$($DC ps -q app1)"
docker network connect --ip 172.30.8.21 trackarr-ha-test_wan "$($DC ps -q tracker1)"
wait_for "dc1 rejoined as Postgres replica" 180 sh -c "$DC exec -T pg2 patronictl list | grep 172.30.8.1 | grep -E 'Replica|Sync' | grep -q streaming"
wait_for "dc1 Redis is a replica" 120 sh -c "$DC exec -T redis1 redis-cli -a test-redis --no-auth-warning role | head -1 | grep -q slave"
wait_for "app1 healthy again" 120 healthy 3001
wait_for "dc1 caught up with writes made during the outage" 30 uploaded_is pg1 2097152

log "PASS"
$DC exec -T pg2 patronictl list
