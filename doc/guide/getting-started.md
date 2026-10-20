# Getting Started

This guide will help you get Trackarr up and running in minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 24 or higher
- **Docker** and Docker Compose
- **OpenSSL** (used by `scripts/setup.sh` to generate secrets)
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
curl -fsSL https://raw.githubusercontent.com/florianjs/trackarr/main/scripts/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

It asks every question first (domains, Let's Encrypt email, monitoring password), checks that the domains point to the server, shows a summary to confirm, then runs unattended. The detailed output goes to `/var/log/trackarr-install.log`, shown on screen only if a step fails.

The installer will automatically:

- Install Docker and dependencies
- Generate cryptographic secrets
- Configure firewall rules
- Set up TLS/SSL with Let's Encrypt
- Create systemd service for auto-restart
- Configure PostgreSQL, Redis, Caddy, and monitoring
- Set up Beszel monitoring

Running it again updates the install and keeps its secrets, data, monitoring password and pairing; the previous answers are the defaults.

For an unattended install, pass the values as environment variables:

```bash
sudo DOMAIN=example.com ACME_EMAIL=admin@example.com ./install.sh --yes
```

`./install.sh --help` lists every option.

After installation, open `https://monitoring.your-domain.com` and log in with the monitoring login shown at the end of the install (also in `.env`: `BESZEL_ADMIN_EMAIL` / `BESZEL_ADMIN_PASSWORD`). Then [pair the agent](/guide/monitoring#pairing-the-agent).

### Option 2: Docker Setup (Interactive)

For local development or production deployment with guided setup:

```bash
# Clone repository
git clone https://github.com/florianjs/trackarr.git && cd trackarr

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
git clone https://github.com/florianjs/trackarr.git && cd trackarr

# Create .env with generated secrets (asks for your domains)
./scripts/setup.sh

# Review .env
nano .env

# Start production stack
docker compose -f docker-compose.prod.yml up -d --build
```

::: tip Required Environment Variables
At minimum, configure these in your `.env`:

- `DOMAIN` — Your main domain (e.g., `tracker.example.com`)
- `TRACKER_DOMAIN` — Announce domain (e.g., `announce.example.com`)
- `MONITORING_DOMAIN` — Monitoring (Beszel) domain (e.g., `monitoring.example.com`)
- `ACME_EMAIL` — Email for Let's Encrypt SSL certificates
- `TRACKER_INTERNAL_TOKEN` — Token shared by the app and the tracker service (`openssl rand -hex 32`)
  :::

Open `https://your-domain.com` to access your tracker.

## First Steps After Installation

1. **Register the first user** — The first registered user automatically becomes an administrator
2. **Set a Panic Password** — This is required and protects your data in emergencies
3. **Configure site settings** — Set your tracker name, description, and rules
4. **Invite users** — Use the invitation system to add trusted members

## Updating

To update your Trackarr installation to the latest version:

```bash
cd /opt/trackarr
git checkout main
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

::: info
Your data (PostgreSQL, Redis) is persisted in Docker volumes and will not be affected by updates.
:::

::: warning Upgrading to the Rust tracker
The tracker now runs as a separate service (`trackarr-tracker`). Installations created before this change must add a shared token to `.env` before rebuilding, otherwise the stack does not start:

```bash
echo "TRACKER_INTERNAL_TOKEN=$(openssl rand -hex 32)" >> .env
docker compose -f docker-compose.prod.yml up -d --build
```

Swarms refill as clients re-announce (up to 10 minutes). Upload/download transferred between the last announce before the upgrade and the first one after is not credited.
:::

::: warning Upgrading: monitoring moved to Beszel
Prometheus, Grafana and the exporters are replaced by [Beszel](/guide/monitoring). After pulling, first add the Beszel login to `.env`: Beszel creates its account from it on its first start, and nobody can create one from the browser.

```bash
echo "BESZEL_ADMIN_EMAIL=you@example.com" >> .env
echo "BESZEL_ADMIN_PASSWORD=$(openssl rand -base64 16 | tr -d '/+=')" >> .env
grep BESZEL_ADMIN .env   # your monitoring login
```

Then start Beszel and remove the old monitoring containers:

```bash
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

Once you no longer need the history, delete the old volumes by hand (`prometheus_data` and `grafana_data`, prefixed with the Compose project name):

```bash
docker volume ls
docker volume rm <project>_prometheus_data <project>_grafana_data
```

Log in to `https://monitoring.your-domain.com` and [pair the Beszel agent](/guide/monitoring#pairing-the-agent). `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` can be removed from `.env`.
:::

## Next Steps

- [Configuration](/guide/configuration) — Learn about environment variables and settings
- [Security](/guide/security) — Understand the security architecture
- [Zero-Knowledge Auth](/guide/zero-knowledge-auth) — How authentication works
