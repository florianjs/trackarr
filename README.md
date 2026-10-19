<div align="center">

# 🌐 Trackarr

**A modern, high-performance private BitTorrent tracker**

Built with Nuxt 4 • PostgreSQL • Redis

[![Node.js](https://img.shields.io/badge/Node.js-24+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?style=flat&logo=nuxtdotjs&logoColor=white)](https://nuxt.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)
[![Discord](https://img.shields.io/badge/Discord-Join%20us-5865F2?style=flat&logo=discord&logoColor=white)](https://discord.gg/bbbkCPkdRk)

[Features](#-features) • [Quick Start](#-quick-start) • [Security](#-security-architecture) • [Documentation](https://florianjs.github.io/trackarr/) • [Live Demo](https://tracker.florianargaud.com/) • [Discord](https://discord.gg/bbbkCPkdRk)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/images/dashboard.png">
  <img alt="Trackarr member dashboard" src="public/images/dashboard-light.png">
</picture>

</div>

---

## ✨ Features

| **Privacy & Authentication**        | **Performance**                   |
| ----------------------------------- | --------------------------------- |
| Zero-Knowledge Authentication       | Rust tracker, in-memory swarms    |
| Proof of Work anti-abuse            | PostgreSQL with full-text search  |
| Private torrents (DHT/PEX disabled) | HTTP announce with passkeys       |
| Ratio tracking & enforcement        | Optimized for high concurrency    |

| **Community**                                 | **Automation**                                      |
| --------------------------------------------- | --------------------------------------------------- |
| Bonus points earned by seeding & uploading    | Torznab API for Prowlarr, Sonarr & Radarr           |
| Bonus shop (upload credit, invites, avatars)  | IMDb / TMDb / TheTVDB IDs with ID-based search      |
| Bounties: request torrents with a points pot  | Personal RSS feeds                                  |
| Global freeleech (timed or open-ended)        | Torrent moderation queue                            |
| Forum, comments, reports, invitations, H&R    | UI in 8 languages (EN, FR, ES, DE, IT, ZH, JA, RU)  |
| Private messages between members, with blocks | Light & dark themes, ⌘K command palette             |

| **Security**                     | **Emergency**                                |
| -------------------------------- | -------------------------------------------- |
| Distributed rate limiting        | **Panic Mode** — Instant database encryption |
| Auto IP blacklisting             | AES-256-GCM protected data                   |
| Sanitized user content (XSS)     | Full restoration with the panic password     |
| Hashed peer IPs in logs & stats  | Unrecoverable without password               |

---

## 🔐 Security Architecture

### Zero-Knowledge Authentication (ZKE)

Trackarr uses a **Zero-Knowledge** authentication system: the server **never sees or stores your password**. All cryptographic operations happen client-side.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        REGISTRATION FLOW                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                              ┌─────────────────┐  │
│  │   CLIENT    │                              │     SERVER      │  │
│  └──────┬──────┘                              └────────┬────────┘  │
│         │                                              │           │
│         │ 1. Solve PoW Challenge (anti-spam)           │           │
│         │ ◄────────────────────────────────────────────┤           │
│         │                                              │           │
│         │ 2. Generate random salt (32 bytes)           │           │
│         │ 3. Derive key = PBKDF2(password, salt)       │           │
│         │ 4. Compute verifier = SHA256(key)            │           │
│         │                                              │           │
│         │ 5. Send {username, salt, verifier} ─────────►│           │
│         │    Password NEVER leaves client           │           │
│         │                                              │           │
│         │                              6. Store salt + │           │
│         │                                 scrypt(verifier)         │
│         │                              7. Create session           │
│         │ ◄──────────────────────────────── 8. OK ─────┤           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          LOGIN FLOW                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐                              ┌─────────────────┐  │
│  │   CLIENT    │                              │     SERVER      │  │
│  └──────┬──────┘                              └────────┬────────┘  │
│         │                                              │           │
│         │ 1. Request challenge ───────────────────────►│           │
│         │                                              │           │
│         │ ◄──────── 2. Return {salt, challenge} ───────┤           │
│         │                                              │           │
│         │ 3. Derive key = PBKDF2(password, salt)       │           │
│         │ 4. Compute verifier = SHA256(key)            │           │
│         │                                              │           │
│         │ 5. Send {username, verifier, challenge} ────►│           │
│         │    over TLS; password NEVER leaves client    │           │
│         │                                              │           │
│         │                       6. Consume challenge   │           │
│         │                       7. scrypt(verifier) ==  │           │
│         │                          stored hash ?       │           │
│         │ ◄──────────────────────────────── 8. Session ┤           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Properties:**

- **Password never transmitted** — Only a verifier derived from it, over TLS
- **PBKDF2 with 100k iterations** — Brute-force resistant
- **Only a scrypt hash of the verifier is stored** — A database copy cannot be replayed to log in; each password must be guessed through PBKDF2 and scrypt
- **Unique, single-use challenge per login** — Decoys for unknown usernames, constant-time failures
- **Proof of Work** — Stops automated registration attacks

---

### 🚨 Panic Mode (Emergency Encryption)

The **Panic Button** allows administrators to **instantly encrypt all sensitive data** in an emergency. Once activated, all torrent files become unusable and user data is unreadable.

```
┌───────────────────────────────────────────────────────────────────┐
│                       NORMAL STATE                                │
│  • Torrents downloadable                                          │
│  • User data readable                                             │
│  • Posts & comments visible                                       │
└───────────────────────────────────────────────────────────────────┘
                              │
                    PANIC ACTIVATED
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                      ENCRYPTED STATE                              │
│  • .torrent files → AES-256-GCM encrypted (unusable)              │
│  • Torrent names  → [ENCRYPTED]                                   │
│  • Torrent sizes  → 0                                             │
│  • User credentials → Encrypted                                   │
│  • Forum posts    → Encrypted                                     │
└───────────────────────────────────────────────────────────────────┘
                              │
                    RESTORE (with password)
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────┐
│                       RESTORED STATE                              │
│  All data restored to original state                              │
└───────────────────────────────────────────────────────────────────┘
```

**How it works:**

1. **First admin** sets a **Panic Password** during registration (min. 12 chars)
2. Only a hash of the panic password is stored, never the password itself
3. **Activation**: Admin → Settings → Panic → confirm and enter the Panic Password
4. **Restoration**: enter the Panic Password (works without being logged in, rate limited)

The encryption key is derived from the panic password itself, so the database alone is not enough to decrypt the data. Encryption and restoration each run in a single transaction: a failure leaves the database unchanged.

**Encryption details:**
| Component | Algorithm |
|-----------|-----------|
| Key Derivation | scrypt (32 bytes) from the panic password, random salt |
| Encryption | AES-256-GCM |
| IV | 12 bytes random, unique per encrypted value |

> **WARNING**: Without the Panic Password, encrypted data is **permanently lost**. There is no recovery mechanism.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 22+ • **Docker** & Docker Compose • **npm**

#### DNS Configuration (Required before installation)

> **IMPORTANT**: Before running the installer, you must configure your DNS records to point to your VPS IP address.

Create the following **A records** pointing to your server's IP:

| Subdomain                    | Record Type | Value       |
| ---------------------------- | ----------- | ----------- |
| `tracker.your-domain.com`    | A           | Your VPS IP |
| `announce.your-domain.com`   | A           | Your VPS IP |
| `monitoring.your-domain.com` | A           | Your VPS IP |

> **Note**: DNS propagation can take up to 24-48 hours, but usually completes within a few minutes. The installer will fail to obtain SSL certificates if DNS is not properly configured.

### Option 1: Automated Installation (Recommended)

> **Best for production deployments.** Handles dependencies, secrets, SSL, and systemd automatically.

```bash
# Download and run the installer
curl -fsSL https://raw.githubusercontent.com/florianjs/trackarr/main/scripts/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

The installer will:

- Install Docker and dependencies
- Generate cryptographic secrets
- Configure firewall rules
- Set up TLS/SSL with Let's Encrypt
- Create systemd service for auto-restart
- Configure PostgreSQL, Redis, Caddy, and monitoring
- Set up Beszel monitoring (host and container stats, alerts)

> **Monitoring**: After installation, open `https://monitoring.your-domain.com` right away. It is protected by basic auth (user `admin`, password shown at the end of the install and saved in `CREDENTIALS.txt`); behind it, the first visitor creates the Beszel admin account.
>
> Then pair the agent once: in Beszel, click **Add system**, use host `/beszel_socket/beszel.sock`, copy the public key and token into `.env` as `BESZEL_AGENT_KEY` and `BESZEL_AGENT_TOKEN`, add `COMPOSE_PROFILES=monitoring`, and run `docker compose -f docker-compose.prod.yml up -d`. See the [Monitoring guide](https://florianjs.github.io/trackarr/guide/monitoring).
>
> Application and tracker figures (growth charts, tracker health, security alerts) are in the Trackarr admin dashboard.

### Option 2: Development with Docker

> PostgreSQL is published on `127.0.0.1:5432` only (not reachable from other machines). Without `IP_HASH_SECRET`, development uses a random secret per process.

```bash
# Clone repository
git clone https://github.com/florianjs/trackarr.git && cd trackarr
cp .env.example .env

# Start all services (app + tracker + postgres + redis)
docker compose up -d

# View logs
docker compose logs -f app
```

**Open [http://localhost:3000](http://localhost:3000)**

![Torrent list with category filters](public/images/torrents.png)
![Torrent page with swarm stats and comments](public/images/torrent.png)

---

## 🔒 Security

> **For production, always use the install script** to ensure proper secret generation and security configuration.

### Key Security Features

| Layer              | Protection                                                 |
| ------------------ | ---------------------------------------------------------- |
| **Authentication** | ZKE, PoW anti-abuse, sealed sessions (7 days), SameSite cookies, roles checked in DB on every request |
| **Database**       | SCRAM-SHA-256 auth, TLS, prepared statements, pool limits  |
| **Redis**          | Password auth, command restrictions, memory limits         |
| **Network**        | Rate limiting, auto IP bans, proxy headers trusted only from `TRUSTED_PROXIES` |
| **Content**        | Sanitized Markdown & rich text, sandboxed uploads, passkey-protected RSS & scrape |
| **Privacy**        | Hashed IPs in peer stats & logs, passkeys stripped from access logs. The last login IP is kept per user for IP bans, and peer IPs live in Redis while a peer is active. |

### Rate Limits

| Endpoint   | Limit   | Ban on Abuse                    |
| ---------- | ------- | ------------------------------- |
| Public API   | 100/min  | 100+ req/10s → auto-block       |
| Mutations    | 10/min   | Progressive penalties           |
| Login        | 10/5min  | Temporary block, no blacklist   |
| Registration | 5/5min   | IP blacklisted after violations |
| Panic restore| 5/5min   | IP blacklisted after violations |
| Tracker      | 200/min  | Distributed sliding window      |

### Production Security Checklist

**Use `install.sh`** — it handles security automatically:

- Generates cryptographic secrets (32-64 chars)
- Configures TLS for all connections
- Sets up Caddy reverse proxy with HTTPS
- Configures firewall (ports 80, 443 only)
- Network isolation (databases not exposed)

**Manual steps after install:**

- [ ] Set up automated PostgreSQL backups

---

## 🏗️ Tech Stack

| Layer    | Technology                          | Purpose                             |
| -------- | ----------------------------------- | ----------------------------------- |
| Frontend | Nuxt 4, Vue 3, Tailwind CSS         | SSR, Composition API                |
| i18n     | @nuxtjs/i18n                        | 8 UI languages                      |
| Backend  | Nitro Server Engine                 | API routes, middleware              |
| Database | PostgreSQL 16 + Drizzle ORM         | Data persistence, full-text search  |
| Cache    | Redis 7                             | Swarm counters, sessions, rate limiting |
| Tracker  | Rust (Tokio, axum), [`tracker/`](tracker/README.md) | HTTP announces & scrapes (no UDP / WebSocket) |
| Crypto   | Web Crypto API, scrypt, AES-256-GCM | ZKE auth, Panic encryption          |
| Monitor  | Beszel + admin dashboard            | Host/container stats, alerting, app metrics |

---

## 🐳 Docker Commands

```bash
docker compose up -d              # Start services
docker compose down               # Stop services
docker compose logs -f            # View logs
docker compose down -v            # Stop + remove volumes
```

### Health Checks

```bash
docker exec trackarr-db pg_isready           # PostgreSQL
docker exec trackarr-redis redis-cli ping    # Redis
docker exec trackarr-tracker /trackarr-tracker --healthcheck && echo ok  # Tracker
```

### Updating

To update your Trackarr installation to the latest version:

```bash
cd /opt/trackarr
git checkout main
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

> **Note**: This will rebuild the containers with the latest code. Your data (PostgreSQL, Redis) is persisted in Docker volumes and will not be affected. Schema changes are applied automatically at startup.
>
> **Upgrading to the Rust tracker?** The tracker now runs as a separate `tracker` service. Add a shared token to `.env` before rebuilding, or the stack will not start: `echo "TRACKER_INTERNAL_TOKEN=$(openssl rand -hex 32)" >> .env`, then `docker compose -f docker-compose.prod.yml up -d --build`. Swarms refill as clients re-announce (up to 10 minutes); transfer between the last announce before the upgrade and the first one after is not credited.
>
> **Upgrading: monitoring moved to Beszel.** Prometheus, Grafana and the exporters are gone. After pulling, run `docker compose -f docker-compose.prod.yml up -d --remove-orphans` to remove the old monitoring containers. Once you no longer need the history, delete the old volumes by hand (`docker volume ls`, then `docker volume rm <project>_prometheus_data <project>_grafana_data`). Then pair the Beszel agent as described above. `GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` can be removed from `.env`.
>
> **Upgrading from 0.5.x to 0.6.x?** Follow the steps in the [v0.6.0 release notes](https://github.com/florianjs/trackarr/releases/tag/v0.6.0) (rotate `NUXT_SESSION_PASSWORD`, new required secrets, RSS now needs a passkey).

### Troubleshooting

**Full restart (stop and start all services):**

```bash
cd /opt/trackarr
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Full restart with rebuild (if you suspect issues with cached images):**

```bash
cd /opt/trackarr
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

**View logs to debug issues:**

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f app  # App only
docker compose -f docker-compose.prod.yml logs -f tracker  # Tracker only
```

---

## 🧪 Development

```bash
npm run dev              # Start dev server (HMR), without the tracker
npm run build            # Production build
npm test                 # Unit & security tests (Vitest)
npx drizzle-kit push     # Push schema changes
npx drizzle-kit studio   # Database GUI
```

**Tracker**: `npm run dev` does not start a tracker. Either keep the `tracker` container from `docker compose up -d` (port 8080), or run it from source with Rust 1.95+: `cd tracker && cargo run`, with `DATABASE_URL`, `REDIS_URL`, `REDIS_PASSWORD` and the same `TRACKER_INTERNAL_TOKEN` as the app. See [`tracker/README.md`](tracker/README.md).

**Translations**: strings live in `i18n/locales/<code>/*.json` (en, fr, es, de, it, zh, ja, ru). To add a language, copy `i18n/locales/en/`, translate it, and declare the locale in `nuxt.config.ts` (`i18n.locales`). `tests/i18n-locales.test.ts` checks every locale against English (keys, placeholders, plural forms); languages with more plural forms than English get a rule in `i18n/plural.ts` (Russian has one).

| Private messages | Admin dashboard |
| --- | --- |
| ![Private messages](public/images/messages.png) | ![Admin dashboard](public/images/admin.png) |

![User profile](public/images/profile.png)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 🙏 Acknowledgements

Trackarr is built on the shoulders of giants. We'd like to thank the following open source projects:

| Project                                                                | Role                        |
| ---------------------------------------------------------------------- | --------------------------- |
| [Nuxt](https://nuxt.com)                                               | Fullstack Vue framework     |
| [Vue.js](https://vuejs.org)                                            | Reactive frontend framework |
| [Tokio](https://tokio.rs) & [axum](https://github.com/tokio-rs/axum)   | Async runtime & HTTP server for the tracker |
| [Drizzle ORM](https://orm.drizzle.team)                                | TypeScript ORM              |
| [PostgreSQL](https://www.postgresql.org)                               | Database                    |
| [Redis](https://redis.io)                                              | In-memory cache             |
| [ioredis](https://github.com/redis/ioredis)                            | Redis client for Node.js    |
| [Tailwind CSS](https://tailwindcss.com)                                | Utility-first CSS           |
| [Chart.js](https://www.chartjs.org)                                    | Charts & visualizations     |
| [Beszel](https://beszel.dev)                                           | Server monitoring & alerts  |
| [VitePress](https://vitepress.dev)                                     | Documentation framework     |
| [Vitest](https://vitest.dev)                                           | Testing framework           |
| [Pinia](https://pinia.vuejs.org)                                       | State management            |
| [Zod](https://zod.dev)                                                 | Schema validation           |
| [Nuxt i18n](https://i18n.nuxtjs.org)                                   | Internationalization        |
| [DOMPurify](https://github.com/cure53/DOMPurify)                       | HTML sanitization           |
| [sanitize-html](https://github.com/apostrophecms/sanitize-html)        | Server-side HTML sanitization |

---

<!-- CONTRIBUTORS:START -->

## 👥 Contributors

Thanks to all our contributors! Sorted by number of commits.

|                                                      Avatar                                                       | Contributor                             | Commits |
| :---------------------------------------------------------------------------------------------------------------: | --------------------------------------- | :-----: |
| <img src="https://avatars.githubusercontent.com/u/50747004?v=4" width="40" height="40" style="border-radius:50%"> | **[Dim145](https://github.com/Dim145)** |    4    |
| <img src="https://avatars.githubusercontent.com/u/64362443?v=4" width="40" height="40" style="border-radius:50%"> | **[IkiaeM](https://github.com/IkiaeM)** |    4    |

<!-- CONTRIBUTORS:END -->

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the P2P community**

[Back to top](#-trackarr)

</div>
