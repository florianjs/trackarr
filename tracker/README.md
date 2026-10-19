# trackarr-tracker

The BitTorrent tracker of Trackarr: a standalone Rust service (binary `trackarr-tracker`, Docker image `trackarr-tracker`, ~6 MB) that handles announces and scrapes for the Nuxt web app. It shares the app's PostgreSQL and Redis.

- **Announce / scrape** on `TRACKER_HTTP_PORT` (8080), HTTP only. UDP and WebSocket trackers are not provided.
- **Private API** on `TRACKER_INTERNAL_PORT` (8090), never exposed by the reverse proxy.

## Rules

Same rules as the former Node tracker:

- Passkey required, banned users rejected
- Pending torrents only for the uploader and staff
- Minimum ratio enforced, except for the uploader, global freeleech, or a proven snatch (`left=0`). Ratio checks include credit not yet flushed to the database.
- Credited upload/download capped by elapsed time × `TRACKER_MAX_RATE_MIBPS`; no upload credited when there is no other leecher
- Duplicate announces within 2 s ignored
- Bonus points and Hit & Run seed time
- Scrape restricted: passkey required, 1–100 info hashes, approved torrents only

## Architecture

| Concern | How |
| --- | --- |
| Swarms (peer lists) | In memory. Nothing is stored per peer in Redis. |
| Counters for the site | Published to Redis every `TRACKER_STATS_INTERVAL` seconds (see [Redis keys](#redis-keys)) |
| Credit, bonus points, HnR seed time | Batched writes to PostgreSQL every `TRACKER_FLUSH_INTERVAL` seconds, and on graceful stop |
| Users, torrents, settings | Read from PostgreSQL, cached 30 s (`TRACKER_CACHE_CAPACITY` entries per cache) |
| Cache invalidation | The app publishes on the Redis channel `<REDIS_KEY_PREFIX>tracker:invalidate`: `users`, `torrents`, `torrent:<hash>`, `settings` |

Docker Compose sets `stop_grace_period: 30s` so the last batch is written on shutdown.

### Restart and failover

Swarms live in memory. On a graceful stop (deploy, `docker compose restart`), the tracker writes every peer to `TRACKER_SNAPSHOT_PATH` (the `/data` volume in Docker) and loads it back on start, then deletes the file: peer lists and credit baselines survive, and counters are published right away.

Without a snapshot (crash, HA failover, first start), swarms refill as clients re-announce, which takes one announce interval (`TRACKER_INTERVAL`, 600 s):

- During the warm-up (`TRACKER_WARMUP`, default interval + 60 s) the tracker publishes nothing: the site keeps showing the last counters.
- The first announce of each peer only sets a baseline. Upload/download transferred between the last announce before and the first one after is **not credited** (up to one interval per peer).
- A passive HA node (receiving no announces) publishes nothing.

The snapshot holds raw peer IPs, like the tracker's memory: keep it on a local volume.

## Configuration

### Tracker

| Variable | Description | Default |
| --- | --- | --- |
| `TRACKER_HTTP_PORT` | Announce/scrape port | `8080` |
| `TRACKER_INTERNAL_PORT` | Private API port | `8090` |
| `TRACKER_INTERNAL_TOKEN` | Bearer token for `/internal/*` (`_FILE` supported). Unset: `/internal/*` returns 404 | — |
| `TRACKER_TRUST_PROXY` | Reverse proxies in front that append to `X-Forwarded-For`: `false`, `true` (one, e.g. Caddy) or a count. The client is taken that many entries from the right. Never enable on a port clients reach directly | `false` |
| `TRACKER_INTERVAL` | Announce interval sent to clients (seconds) | `600` |
| `TRACKER_MAX_RATE_MIBPS` | Credit ceiling per peer (MiB/s) | `100` |
| `TRACKER_FLUSH_INTERVAL` | Seconds between credit writes to PostgreSQL | `5` |
| `TRACKER_STATS_INTERVAL` | Seconds between counter publications to Redis | `60` |
| `TRACKER_WARMUP` | Seconds after start before publishing | interval + 60 |
| `TRACKER_CACHE_CAPACITY` | Entries per lookup cache (users, torrents) | `500000` |
| `TRACKER_SNAPSHOT_PATH` | Swarm snapshot written on stop, loaded on start. Unset: disabled | `/data/swarms.bin` in the image |
| `TRACKER_MAX_PEERS_PER_USER` | Peers one user may have in one swarm (several clients or machines); more are refused | `3` |
| `TRACKER_MAX_FAILURES_PER_MINUTE` | Failed lookups (invalid passkey, unknown torrent) per client before it is refused without database access for the rest of the minute; IPv6 grouped by /64 | `120` |
| `TRACKER_HEADER_TIMEOUT_SECS` | Time a client gets to send request headers | `10` |
| `TRACKER_MAX_CONNECTIONS` | Simultaneous connections per listener; extra ones are closed | `10000` |
| `DB_POOL_WAIT_MS` | Longest wait for a database connection before the request fails | `2000` |
| `TRACKER_DEBUG` | `true` enables the tracker's own debug logs | `false` |
| `RUST_LOG` | Log filter, overrides `TRACKER_DEBUG`. Driver debug logs print query parameters (passkeys): avoid in production | — |

### Shared with the app

| Variable | Description | Default |
| --- | --- | --- |
| `DATABASE_URL` | PostgreSQL URL; multiple hosts and `target_session_attrs=primary` supported | `postgres://tracker:tracker@localhost:5432/trackarr` |
| `DB_POOL_MAX` | Connection pool size | `16` |
| `DB_CONNECT_TIMEOUT` | Connect timeout (seconds) | `10` |
| `DB_KEEP_ALIVE` | TCP keepalive idle time (seconds) | `60` |
| `DB_SSL` | `true` is refused (not supported yet) | — |
| `REDIS_URL` | Redis URL. TLS (`rediss://`, `REDIS_TLS=true`) is refused (not supported yet) | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Redis password (`_FILE` supported) | — |
| `REDIS_SENTINELS` | Sentinel hosts (`host:port,host:port`) | — |
| `REDIS_SENTINEL_NAME` | Sentinel master name | `mymaster` |
| `REDIS_SENTINEL_PASSWORD` | Sentinel password (`_FILE` supported) | — |
| `REDIS_COMMAND_TIMEOUT_MS` | Redis command timeout | `5000` |
| `REDIS_KEY_PREFIX` | Prefix of every Redis key and channel | `ot:` |
| `IP_HASH_SECRET` | Secret for hashing peer IPs (`_FILE` supported). With `NODE_ENV=production`: required, ≥ 32 characters. Otherwise a random per-process secret is used when unset | — |

The web app needs `TRACKER_INTERNAL_URL` (default `http://localhost:8090`, `http://tracker:8090` in Docker Compose) and the same `TRACKER_INTERNAL_TOKEN`.

## Private API

| Endpoint | Auth | Description |
| --- | --- | --- |
| `GET /health` | none | Liveness (`ok`) |
| `GET /metrics` | none | Prometheus metrics (aggregates only) |
| `GET /internal/status` | `Authorization: Bearer $TRACKER_INTERNAL_TOKEN` | Uptime, announces, swarms, seeders, leechers, pending accounting, published |
| `GET /internal/swarms/{hash}` | `Authorization: Bearer $TRACKER_INTERNAL_TOKEN` | Peers of a swarm (hashed IPs only) |

Abuse counters in `/metrics`: `trackarr_tracker_rejected_total{reason="invalid_passkey|unknown_torrent|too_many_peers|blocked_client"}` and `trackarr_tracker_blocked_clients` (clients currently refused).

## Redis keys

All keys are prefixed with `REDIS_KEY_PREFIX` (default `ot:`).

| Key | Type | Content |
| --- | --- | --- |
| `tracker:swarms` | hash | info hash → `seeders:leechers` |
| `tracker:user_activity` | hash | user id → `seeding:leeching` |
| `tracker:stats` | hash | `torrents`, `peers`, `seeders`, `leechers`, `seededTorrents`, `uniquePeers`, `uniqueSeeders`, `updatedAt` |
| `stats:<hash>` | hash | field `completed` |
| `tracker:invalidate` | pub/sub channel | Cache invalidation from the app |
| `tracker:abuse_events` | list (last 1000) | Abuse for admin alerts, drained by the app every minute: `blocked_client` (failed-lookup budget exceeded), `impossible_upload` (upload claimed beyond `TRACKER_MAX_RATE_MIBPS` × elapsed time: possible ratio cheat) |

## Development

Requires Rust 1.95+.

```bash
cd tracker
DATABASE_URL=postgres://tracker:tracker@localhost:5432/trackarr \
REDIS_URL=redis://localhost:6379 REDIS_PASSWORD=... \
TRACKER_INTERNAL_TOKEN=dev-internal-token \
cargo run
```

Give the web app the same `TRACKER_INTERNAL_TOKEN`. With `docker compose up -d` the tracker runs in its own container on `:8080` (both sides use `dev-internal-token` by default).

```bash
cargo test                                  # Unit tests
cargo clippy --all-targets -- -D warnings   # Lint
cargo fmt --check                           # Formatting

# Docker image (from the repository root)
docker build -t trackarr-tracker tracker
```
