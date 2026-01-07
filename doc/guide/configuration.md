# Configuration

Trackarr is configured primarily through environment variables. This page covers all available options.

## Environment Variables

### Core Settings

| Variable                | Description                        | Default       |
| ----------------------- | ---------------------------------- | ------------- |
| `NUXT_PUBLIC_SITE_NAME` | Your tracker's display name        | `Trackarr` |
| `NUXT_PUBLIC_SITE_URL`  | Public URL of your tracker         | —             |
| `NUXT_SESSION_PASSWORD` | Session encryption key (32+ chars) | —             |

### Database

| Variable            | Description                  | Default       |
| ------------------- | ---------------------------- | ------------- |
| `DATABASE_URL`      | PostgreSQL connection string | —             |
| `POSTGRES_USER`     | Database username            | `opentracker` |
| `POSTGRES_PASSWORD` | Database password            | —             |
| `POSTGRES_DB`       | Database name                | `opentracker` |

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
| `TRACKER_UDP_URL`  | UDP announce URL                            | `udp://localhost:8081/announce`  |
| `TRACKER_WS_URL`   | WebSocket URL                               | `ws://localhost:8082`            |
| `TRACKER_DEBUG`    | Enable verbose tracker logging              | `false`                          |

::: tip Configuring Tracker URLs
These URLs are embedded in `.torrent` files and displayed in the admin dashboard. Configure them with your actual domain:

```bash
# In your .env file
TRACKER_HTTP_URL=https://tracker.your-domain.com/announce
TRACKER_UDP_URL=udp://tracker.your-domain.com:8081/announce
TRACKER_WS_URL=wss://tracker.your-domain.com/ws
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

- **app** — Main Trackarr application
- **db** — PostgreSQL 16 database
- **redis** — Redis 7 cache
- **caddy** — Reverse proxy with automatic HTTPS
- **prometheus** — Metrics collection
- **grafana** — Dashboards and monitoring

### Development (`docker-compose.yml`)

A simplified setup for local development:

```yaml
services:
  app:
    build: .
    ports:
      - '3000:3000'
    environment:
      - DATABASE_URL=postgresql://opentracker:opentracker@db:5432/opentracker
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=opentracker
      - POSTGRES_PASSWORD=opentracker
      - POSTGRES_DB=opentracker
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
```

## Caddy Configuration

The production setup uses Caddy for automatic HTTPS. Configuration is in `docker/Caddyfile`:

```
{$DOMAIN} {
    reverse_proxy app:3000
}

announce.{$DOMAIN} {
    reverse_proxy app:3000
}

monitoring.{$DOMAIN} {
    handle_path /grafana* {
        reverse_proxy grafana:3000
    }
    handle_path /prometheus* {
        reverse_proxy prometheus:9090
    }
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
