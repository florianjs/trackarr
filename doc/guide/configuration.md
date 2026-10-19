# Configuration

Trackarr is configured primarily through environment variables. This page covers all available options.

## Environment Variables

### Core Settings

| Variable                | Description                        | Default    |
| ----------------------- | ---------------------------------- | ---------- |
| `NUXT_PUBLIC_SITE_NAME` | Your tracker's display name        | `Trackarr` |
| `NUXT_PUBLIC_SITE_URL`  | Public URL of your tracker         | —          |
| `NUXT_SESSION_PASSWORD` | Session encryption key (32+ chars) | —          |

### Database

| Variable            | Description                  | Default    |
| ------------------- | ---------------------------- | ---------- |
| `DATABASE_URL`      | PostgreSQL connection string | —          |
| `POSTGRES_USER`     | Database username            | `tracker`  |
| `POSTGRES_PASSWORD` | Database password            | —          |
| `POSTGRES_DB`       | Database name                | `trackarr` |

### Redis

| Variable         | Description             | Default                  |
| ---------------- | ----------------------- | ------------------------ |
| `REDIS_URL`      | Redis connection string | `redis://localhost:6379` |
| `REDIS_PASSWORD` | Redis password          | —                        |

### Tracker

| Variable           | Description                                 | Default                          |
| ------------------ | ------------------------------------------- | -------------------------------- |
| `TRACKER_SECRET`   | Secret for generating passkeys              | —                                |
| `IP_HASH_SECRET`   | Secret for hashing peer IPs                 | —                                |
| `TRACKER_HTTP_URL` | HTTP announce URL (shown in .torrent files) | `http://localhost:8080/announce` |
| `TRACKER_DEBUG`    | Enable verbose tracker logging              | `false`                          |
| `TRACKER_INTERNAL_URL`   | Tracker service private API (app side)  | `http://localhost:8090`          |
| `TRACKER_INTERNAL_TOKEN` | Shared token between the app and the tracker service | —                       |

The tracker runs as a separate service (`trackarr-tracker`, HTTP only). UDP and WebSocket announces are not served. Tracker service settings are listed in the [environment reference](../reference/env.md#tracker).

::: tip Configuring the Tracker URL
This URL is embedded in `.torrent` files and displayed in the admin dashboard. Configure it with your actual domain:

```bash
# In your .env file
TRACKER_HTTP_URL=https://tracker.your-domain.com/announce
```

Replace `your-domain.com` with your actual tracker domain.
:::

### Security

| Variable            | Description                     | Default |
| ------------------- | ------------------------------- | ------- |
| `POW_DIFFICULTY`    | Proof of Work difficulty (1-10) | `5`     |
| `RATE_LIMIT_WINDOW` | Rate limit window in seconds    | `60`    |
| `RATE_LIMIT_MAX`    | Max requests per window         | `100`   |

## Docker Compose Configuration

### Production (`docker-compose.prod.yml`)

The production compose file includes:

- **app** — Main Trackarr application (website and API)
- **tracker** — BitTorrent tracker service in Rust (announces, scrapes)
- **postgres** — PostgreSQL 16 database
- **pgbouncer** — Connection pooling in front of PostgreSQL
- **redis** — Redis 7 cache
- **caddy** — Reverse proxy with automatic HTTPS
- **beszel** — Monitoring hub and UI ([Monitoring](/guide/monitoring))
- **beszel-agent** — Host and container stats (Compose profile `monitoring`, starts once paired)
- **docker-proxy** — Read-only Docker API filter for the agent (Compose profile `monitoring`)

### Development (`docker-compose.yml`)

A simplified setup for local development:

```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://tracker:tracker@db:5432/trackarr
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=tracker
      - POSTGRES_PASSWORD=tracker
      - POSTGRES_DB=trackarr
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

## Caddy Configuration

The production setup uses Caddy for automatic HTTPS. Configuration is in `docker/caddy/Caddyfile`:

```
{$DOMAIN} {
    reverse_proxy app:3000
}

announce.{$DOMAIN} {
    reverse_proxy app:3000
}

{$MONITORING_DOMAIN} {
    basicauth {
        {$MONITORING_USER:admin} {$MONITORING_PASSWORD_HASH}
    }
    reverse_proxy trackarr-beszel:8090
}
```

## Security Recommendations

::: danger Production Checklist
Always use the `install.sh` script for production deployments. It handles:

- Generating cryptographically secure secrets
- Configuring TLS for all connections
- Setting up firewall rules
- Network isolation for databases
  :::

For manual deployments, ensure:

1. All secrets are at least 32 characters
2. Database ports are not exposed publicly
3. Redis is password-protected
4. HTTPS is enforced on all endpoints
