# Environment Variables

Complete reference for all environment variables used by Trackarr.

## Required Variables

These must be set for the application to run:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://:password@host:6379` |
| `NUXT_SESSION_PASSWORD` | Session encryption key (32+ chars) | Random string |
| `TRACKER_SECRET` | Secret for passkey generation | Random string |
| `IP_HASH_SECRET` | Secret for IP hashing | Random string |

## Application Settings

| Variable | Description | Default |
|----------|-------------|---------|
| `NUXT_PUBLIC_SITE_NAME` | Display name of your tracker | `Trackarr` |
| `NUXT_PUBLIC_SITE_URL` | Public URL | — |
| `NUXT_PUBLIC_ANNOUNCE_URL` | Announce URL for torrents | — |
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Application port | `3000` |

## Database

| Variable | Description | Default |
|----------|-------------|---------|
| `POSTGRES_USER` | PostgreSQL username | `opentracker` |
| `POSTGRES_PASSWORD` | PostgreSQL password | — |
| `POSTGRES_DB` | Database name | `opentracker` |
| `POSTGRES_HOST` | Database host | `localhost` |
| `POSTGRES_PORT` | Database port | `5432` |

## Redis

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | — |

## Security

| Variable | Description | Default |
|----------|-------------|---------|
| `POW_DIFFICULTY` | Proof of Work difficulty (1-10) | `5` |
| `RATE_LIMIT_WINDOW` | Rate limit window (seconds) | `60` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `SESSION_MAX_AGE` | Session lifetime (seconds) | `604800` (7 days) |

## Tracker

| Variable | Description | Default |
|----------|-------------|---------|
| `TRACKER_INTERVAL` | Announce interval (seconds) | `1800` |
| `TRACKER_MIN_INTERVAL` | Minimum announce interval | `900` |
| `TRACKER_MAX_PEERS` | Max peers returned per announce | `50` |

## Monitoring

| Variable | Description | Default |
|----------|-------------|---------|
| `GRAFANA_ADMIN_USER` | Grafana admin username | `admin` |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password | `admin` |
| `GF_SERVER_ROOT_URL` | Grafana public URL | — |

## Example `.env` File

```bash
# Application
NUXT_PUBLIC_SITE_NAME="My Private Tracker"
NUXT_PUBLIC_SITE_URL="https://tracker.example.com"
NUXT_PUBLIC_ANNOUNCE_URL="https://announce.example.com/announce"
NODE_ENV=production

# Database
DATABASE_URL="postgresql://opentracker:secretpassword@db:5432/opentracker"
POSTGRES_USER=opentracker
POSTGRES_PASSWORD=secretpassword
POSTGRES_DB=opentracker

# Redis
REDIS_URL="redis://:redispassword@redis:6379"
REDIS_PASSWORD=redispassword

# Security
NUXT_SESSION_PASSWORD="your-32-character-session-password-here"
TRACKER_SECRET="your-tracker-secret-for-passkeys"
IP_HASH_SECRET="your-ip-hashing-secret"
POW_DIFFICULTY=5

# Tracker
TRACKER_INTERVAL=1800
TRACKER_MIN_INTERVAL=900
```

::: warning
Never commit `.env` files to version control. Use `.env.example` as a template.
:::
