# Getting Started

This guide will help you get OpenTracker up and running in minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 20 or higher
- **Docker** and Docker Compose
- **npm** package manager

## DNS Configuration

::: warning Required Before Installation
You must configure your DNS records to point to your VPS IP address before running the installer.
:::

Create the following **A records** pointing to your server's IP:

| Subdomain                    | Record Type | Value       |
| ---------------------------- | ----------- | ----------- |
| `tracker.your-domain.com`    | A           | Your VPS IP |
| `announce.your-domain.com`   | A           | Your VPS IP |
| `monitoring.your-domain.com` | A           | Your VPS IP |

::: tip
DNS propagation usually completes within a few minutes, but can take up to 24-48 hours. The installer will fail to obtain SSL certificates if DNS is not properly configured.
:::

## Installation Options

### Option 1: Automated Installation (Recommended)

Best for production deployments. Handles dependencies, secrets, SSL, and systemd automatically.

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/florianjs/opentracker/main/scripts/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

The installer will automatically:

- Install Docker and dependencies
- Generate cryptographic secrets
- Configure firewall rules
- Set up TLS/SSL with Let's Encrypt
- Create systemd service for auto-restart
- Configure PostgreSQL, Redis, Caddy, and monitoring
- Set up Prometheus + Grafana monitoring

After installation, Grafana is accessible at `https://monitoring.your-domain.com/grafana` with default credentials `admin` / `admin`.

### Option 2: Docker Setup (Interactive)

For local development or production deployment with guided setup:

```bash
# Clone repository
git clone https://github.com/florianjs/opentracker.git && cd opentracker

# Run interactive setup
./scripts/setup.sh
```

The setup script will:

- Ask if you want **development** or **production** mode
- For production: prompt for domain names and email
- Generate all cryptographic secrets automatically
- Configure tracker announce URLs
- Create a ready-to-use `.env` file

Then start the services:

```bash
# Development
docker compose up -d

# Production (with SSL, Caddy, monitoring)
docker compose -f docker-compose.prod.yml up -d --build
```

### Option 3: Manual Docker Setup (Not Recommended)

For full manual control over the installation:

```bash
# Clone repository
git clone https://github.com/florianjs/opentracker.git && cd opentracker

# Copy and configure environment
cp .env.example .env

# Generate secrets (or set them manually in .env)
./scripts/generate-secrets.sh

# Edit .env with your domain and settings
nano .env

# Start production stack
docker compose -f docker-compose.prod.yml up -d --build
```

::: tip Required Environment Variables
At minimum, configure these in your `.env`:

- `DOMAIN` — Your main domain (e.g., `tracker.example.com`)
- `TRACKER_DOMAIN` — Announce domain (e.g., `announce.example.com`)
- `MONITORING_DOMAIN` — Grafana domain (e.g., `monitoring.example.com`)
- `ACME_EMAIL` — Email for Let's Encrypt SSL certificates
  :::

Open `https://your-domain.com` to access your tracker.

## First Steps After Installation

1. **Register the first user** — The first registered user automatically becomes an administrator
2. **Set a Panic Password** — This is required and protects your data in emergencies
3. **Configure site settings** — Set your tracker name, description, and rules
4. **Invite users** — Use the invitation system to add trusted members

## Updating

To update your OpenTracker installation to the latest version:

```bash
cd /opt/opentracker
git checkout main
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

::: info
Your data (PostgreSQL, Redis) is persisted in Docker volumes and will not be affected by updates.
:::

## Next Steps

- [Configuration](/guide/configuration) — Learn about environment variables and settings
- [Security](/guide/security) — Understand the security architecture
- [Zero-Knowledge Auth](/guide/zero-knowledge-auth) — How authentication works
