# Environment Variables

Complete reference for all environment variables used by Trackarr.

## Required Variables

These must be set for the application to run:

| Variable                | Description                        | Example                               |
| ----------------------- | ---------------------------------- | ------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string       | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL`             | Redis connection string            | `redis://:password@host:6379`         |
| `NUXT_SESSION_PASSWORD` | Session encryption key (32+ chars) | Random string                         |
| `TRACKER_SECRET`        | Secret for passkey generation      | Random string                         |
| `IP_HASH_SECRET`        | Secret for IP hashing              | Random string                         |
| `TRACKER_INTERNAL_TOKEN` | Token between the app and the tracker service | `openssl rand -hex 32`          |

## Application Settings

| Variable                   | Description                  | Default       |
| -------------------------- | ---------------------------- | ------------- |
| `NUXT_PUBLIC_SITE_NAME`    | Display name of your tracker | `Trackarr`    |
| `NUXT_PUBLIC_SITE_URL`     | Public URL                   | —             |
| `NUXT_PUBLIC_ANNOUNCE_URL` | Announce URL for torrents    | —             |
| `NODE_ENV`                 | Environment mode             | `development` |
| `PORT`                     | Application port             | `3000`        |

## Database

| Variable            | Description         | Default     |
| ------------------- | ------------------- | ----------- |
| `POSTGRES_USER`     | PostgreSQL username | `tracker`   |
| `POSTGRES_PASSWORD` | PostgreSQL password | —           |
| `POSTGRES_DB`       | Database name       | `trackarr`  |
| `POSTGRES_HOST`     | Database host       | `localhost` |
| `POSTGRES_PORT`     | Database port       | `5432`      |

## Redis

| Variable         | Description    | Default     |
| ---------------- | -------------- | ----------- |
| `REDIS_HOST`     | Redis host     | `localhost` |
| `REDIS_PORT`     | Redis port     | `6379`      |
| `REDIS_PASSWORD` | Redis password | —           |

## Security

| Variable            | Description                                                                                         | Default           |
| ------------------- | --------------------------------------------------------------------------------------------------- | ----------------- |
| `POW_DIFFICULTY`    | Registration Proof of Work in bits (16-32), see [configuration](../guide/configuration.md#security) | `22`              |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds)                                                                         | `60`              |
| `RATE_LIMIT_MAX`    | Max requests per window                                                                             | `100`             |
| `SESSION_MAX_AGE`   | Session lifetime (seconds)                                                                          | `604800` (7 days) |

### Security alerts

Brute force (per account and from the tracker), honeypot hits, blocked IPs and impossible upload claims (possible ratio cheats) are listed in the admin dashboard. To be notified as well, set one or more webhooks (production only, unless `ENABLE_DEV_ALERTS=true`). The same alert is sent at most once every 5 minutes per IP, user or account.

| Variable               | Description                                                                        | Default |
| ---------------------- | ---------------------------------------------------------------------------------- | ------- |
| `DISCORD_WEBHOOK_URL`  | Discord webhook for security alerts                                                | —       |
| `SLACK_WEBHOOK_URL`    | Slack webhook for security alerts                                                  | —       |
| `SECURITY_WEBHOOK_URL` | Any endpoint: receives the alert as JSON (`type`, `severity`, `title`, `ip`, …)    | —       |
| `ENABLE_DEV_ALERTS`    | Send webhooks outside production too                                               | `false` |
| `HONEYPOT_BAN`         | `false`: honeypot paths (`/wp-admin`, `/.env`, `*.php`…) only alert, without blocking the IP (blocks start at 5 min and double up to 24 h) | `true` |

## Tracker

The tracker is a separate service (`tracker/`, container `trackarr-tracker`). It also reads `DATABASE_URL`, `DB_POOL_MAX` (default `16`), `DB_CONNECT_TIMEOUT`, `DB_KEEP_ALIVE`, `REDIS_URL`, `REDIS_PASSWORD`, the Sentinel variables, `REDIS_COMMAND_TIMEOUT_MS` (default `5000`), `REDIS_KEY_PREFIX` (default `ot:`) and `IP_HASH_SECRET` (≥ 32 characters with `NODE_ENV=production`). `DB_SSL=true` and Redis TLS are not supported by the tracker yet. See [`tracker/README.md`](https://github.com/florianjs/trackarr/blob/main/tracker/README.md).

| Variable                 | Description                                                                 | Default         |
| ------------------------ | --------------------------------------------------------------------------- | --------------- |
| `TRACKER_HTTP_PORT`      | Announce/scrape port (HTTP)                                                 | `8080`          |
| `TRACKER_INTERNAL_PORT`  | Private API port (`/health`, `/metrics`, `/internal/*`)                     | `8090`          |
| `TRACKER_INTERNAL_TOKEN` | Bearer token for `/internal/*`, same value on the app (`_FILE` supported)   | —               |
| `TRACKER_TRUST_PROXY`    | Proxies setting `X-Forwarded-For`: `false`, `true` (one, e.g. Caddy) or a count. Never on a directly exposed port | `false`         |
| `TRACKER_INTERVAL`       | Announce interval (seconds)                                                 | `600`           |
| `TRACKER_MAX_RATE_MIBPS` | Credit ceiling per peer (MiB/s)                                             | `100`           |
| `TRACKER_FLUSH_INTERVAL` | Seconds between credit writes to PostgreSQL                                 | `5`             |
| `TRACKER_STATS_INTERVAL` | Seconds between counter publications to Redis                               | `60`            |
| `TRACKER_WARMUP`         | Seconds after start before publishing counters                              | interval + 60   |
| `TRACKER_CACHE_CAPACITY` | Entries per lookup cache (users, torrents)                                  | `500000`        |
| `TRACKER_SNAPSHOT_PATH`  | Swarm snapshot written on graceful stop, loaded on start (unset: disabled)  | `/data/swarms.bin` in the image |
| `TRACKER_MAX_PEERS_PER_USER` | Peers one user may have in one swarm | `3` |
| `TRACKER_MAX_FAILURES_PER_MINUTE` | Failed lookups per client (IPv6 /64) before it is refused for the minute | `120` |
| `TRACKER_HEADER_TIMEOUT_SECS` | Time a client gets to send request headers | `10` |
| `TRACKER_MAX_CONNECTIONS` | Simultaneous connections per listener | `10000` |
| `DB_POOL_WAIT_MS` | Longest wait for a database connection (tracker) | `2000` |
| `TRACKER_DEBUG`          | Enable the tracker's debug logs                                             | `false`         |
| `RUST_LOG`               | Log filter, overrides `TRACKER_DEBUG` (driver debug logs print passkeys)    | —               |

The web app reaches the tracker's private API with:

| Variable                 | Description                                  | Default                                              |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------- |
| `TRACKER_INTERNAL_URL`   | Tracker private API URL                      | `http://localhost:8090` (`http://tracker:8090` in Docker Compose) |
| `TRACKER_INTERNAL_TOKEN` | Same value as the tracker                    | —                                                    |

## Monitoring

Production only. See [Monitoring](/guide/monitoring).

| Variable                   | Description                                                                                     | Default |
| -------------------------- | ----------------------------------------------------------------------------------------------- | ------- |
| `MONITORING_DOMAIN`        | Domain serving Beszel through Caddy                                                             | `monitoring.localhost` |
| `BESZEL_ADMIN_EMAIL`       | Beszel login email, account created on Beszel's first start only                                | —       |
| `BESZEL_ADMIN_PASSWORD`    | Beszel login password (8+ characters), first start only: change it in Beszel afterwards          | —       |
| `BESZEL_AGENT_KEY`         | Public key shown by Beszel when adding the system (host `/beszel_socket/beszel.sock`)            | —       |
| `BESZEL_AGENT_TOKEN`       | Token shown by Beszel with the key                                                              | —       |
| `COMPOSE_PROFILES`         | Set to `monitoring` once paired, so the Beszel agent starts                                     | —       |

## Example `.env` File

```bash
# Application
NUXT_PUBLIC_SITE_NAME="My Private Tracker"
NUXT_PUBLIC_SITE_URL="https://tracker.example.com"
NUXT_PUBLIC_ANNOUNCE_URL="https://announce.example.com/announce"
NODE_ENV=production

# Database
DATABASE_URL="postgresql://tracker:secretpassword@db:5432/trackarr"
POSTGRES_USER=tracker
POSTGRES_PASSWORD=secretpassword
POSTGRES_DB=trackarr

# Redis
REDIS_URL="redis://:redispassword@redis:6379"
REDIS_PASSWORD=redispassword

# Security
NUXT_SESSION_PASSWORD="your-32-character-session-password-here"
TRACKER_SECRET="your-tracker-secret-for-passkeys"
IP_HASH_SECRET="your-ip-hashing-secret"
POW_DIFFICULTY=22

# Tracker
TRACKER_INTERNAL_TOKEN="output-of-openssl-rand-hex-32"
```

::: warning
Never commit `.env` files to version control. Use `.env.example` as a template.
:::

## High Availability

Only needed for a [replicated deployment](../guide/high-availability.md); every default keeps the single-server behaviour.

| Variable                         | Description                                                             | Default     |
| -------------------------------- | ----------------------------------------------------------------------- | ----------- |
| `TRACKER_BACKUP_HTTP_URLS`       | Other sites' announce URLs (comma separated), fallback tiers in .torrent | —           |
| `REDIS_SENTINELS`                | Sentinels as `host:port,host:port`; enables Sentinel mode               | —           |
| `REDIS_SENTINEL_NAME`            | Sentinel master group name                                              | `mymaster`  |
| `REDIS_SENTINEL_PASSWORD`        | Sentinel password, if they require one                                  | —           |
| `REDIS_SENTINEL_TLS`             | `true` when Sentinels use TLS (the Redis nodes follow `REDIS_TLS`)      | `false`     |
| `REDIS_COMMAND_TIMEOUT_MS`       | Fail Redis commands that get no reply after this delay                  | — (no limit)|
| `DB_CONNECT_TIMEOUT`             | PostgreSQL connect timeout (seconds)                                    | `10`        |
| `DB_IDLE_TIMEOUT`                | Close idle connections after (seconds), `0` = never                     | `30`        |
| `DB_KEEP_ALIVE`                  | Seconds before TCP keepalive probes on database connections            | `60`        |

For several PostgreSQL nodes, list them in `DATABASE_URL` and keep only the primary:
`postgres://user:pass@db1:5432,db2:5432/trackarr?target_session_attrs=primary`
