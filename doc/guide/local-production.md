# Local Production Environment

This guide explains how to set up a **production-like environment** on your local machine. This is useful for testing production builds, database migrations, and services (Redis, PostgreSQL) in a configuration that closely mirrors the real deployment.

> [!NOTE]
> This setup is optimized for **OrbStack** on macOS, but standard Docker Desktop is also supported.

## Prerequisites

- **Docker** (or OrbStack) must be installed and running.
- **OrbStack** is recommended for better performance and local domain names (e.g., `http://opentracker.orb.local`).

## Automated Setup

We provide a script to automate the entire process: generating secrets, creating configuration files, and starting services.

```bash
./scripts/setup-local-prod.sh
```

### What does this script do?

1.  **Checks Prerequisites**: Verifies Docker/OrbStack availability.
2.  **Generates Secrets**: Creates a `.env.local-prod` file with secure, random credentials for DB, Redis, and APIs.
3.  **Clean Start**: Aggressively stops and removes any conflicting containers (`opentracker-*`).
4.  **Builds & Starts**: Builds the production Docker image and starts the stack using `docker-compose.local.yml`.
5.  **Health Checks**: Waits for PostgreSQL and Redis to be fully ready.
6.  **Migrations**: Automatically pushes the latest database schema.

## Accessing Services

Once the script completes, you can access the services at the following URLs:

### Standard Docker (localhost)

| Service      | URL                              | Credentials       |
| :----------- | :------------------------------- | :---------------- |
| **Frontend** | `http://localhost:3000`          | -                 |
| **Tracker**  | `http://localhost:8080/announce` | -                 |
| **Grafana**  | `http://localhost:3001`          | `admin` / `admin` |

### With OrbStack (Recommended)

If you are using OrbStack, you can also use these convenient local domains:

| Service      | URL                                         |
| :----------- | :------------------------------------------ |
| **Frontend** | `http://opentracker.orb.local:3000`         |
| **Grafana**  | `http://opentracker-grafana.orb.local:3000` |

## Manage the Environment

The setup script creates a specific environment file `.env.local-prod`. You should use this file when running Docker Compose commands manually.

### Common Commands

**View Logs:**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local-prod logs -f
```

**Stop Services:**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local-prod down
```

**Restart Services:**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local-prod restart
```

**Open Database (PSQL):**

```bash
docker compose -f docker-compose.local.yml --env-file .env.local-prod exec postgres psql -U tracker -d opentracker
```

## Troubleshooting

### "Bind for 0.0.0.0:3000 failed: port is already allocated"

This means another service is using port 3000 (likely your dev server).

- **Solution**: Stop your local dev server (`npm run dev`) before running the production stack.

### Database connection errors

If the app cannot connect to the database, ensure the `.env.local-prod` file exists and contains the correct credentials. The script generates this automatically, but if you manually modified it, credentials might be out of sync.

- **Solution**: Re-run `./scripts/setup-local-prod.sh` to regenerate everything and ensure consistency.

### "Permission denied" on scripts

If the script fails to run:

```bash
chmod +x scripts/setup-local-prod.sh
```
