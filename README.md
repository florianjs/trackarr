<div align="center">

# 🌐 OpenTracker

**A modern, high-performance private BitTorrent tracker**

Built with Nuxt 4 • PostgreSQL • Redis

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Nuxt](https://img.shields.io/badge/Nuxt-4-00DC82?style=flat&logo=nuxtdotjs&logoColor=white)](https://nuxt.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat)](LICENSE)

[Features](#-features) • [Quick Start](#-quick-start) • [Security](#-security-architecture) • [Documentation](#-tech-stack) • [Live Demo](https://tracker.florianargaud.com/)

![OpenTracker Homepage](/public/images/image%20copy%203.png)

</div>

---

## ✨ Features

| **Privacy & Authentication**        | **Performance**                   |
| ----------------------------------- | --------------------------------- |
| Zero-Knowledge Authentication       | Redis-powered sub-ms peer lookups |
| Proof of Work anti-abuse            | PostgreSQL with full-text search  |
| Private torrents (DHT/PEX disabled) | HTTP & WebSocket announce support |
| Ratio tracking & enforcement        | Optimized for high concurrency    |

| **Security**              | **Emergency**                                |
| ------------------------- | -------------------------------------------- |
| Distributed rate limiting | **Panic Mode** — Instant database encryption |
| Auto IP blacklisting      | AES-256-GCM protected data                   |
| SQL/XSS attack detection  | Full restoration with master password        |
| SHA-256 hashed IPs        | Unrecoverable without password               |

---

## 🔐 Security Architecture

### Zero-Knowledge Authentication (ZKE)

OpenTracker uses a **Zero-Knowledge** authentication system: the server **never sees or stores your password**. All cryptographic operations happen client-side.

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
│         │                                 verifier     │           │
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
│         │ 5. Generate proof = SHA256(verifier+challenge)           │
│         │                                              │           │
│         │ 6. Send {username, proof, challenge} ───────►│           │
│         │    Password NEVER leaves client           │           │
│         │                                              │           │
│         │                       7. Compute expected =  │           │
│         │                          SHA256(storedVerifier+challenge)│
│         │                       8. Verify proof == expected        │
│         │ ◄──────────────────────────────── 9. Session ┤           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Properties:**

- **Password never transmitted** — Only cryptographic proofs
- **PBKDF2 with 100k iterations** — Brute-force resistant
- **Unique challenge per login** — Prevents replay attacks
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
2. Panic password is hashed and stored securely (never in plaintext)
3. **Activation**: Admin → Settings → Panic → Type `ENCRYPT_ALL_DATA`
4. **Restoration**: Enter the original Panic Password

**Encryption details:**
| Component | Algorithm |
|-----------|-----------|
| Key Derivation | scrypt (32 bytes) |
| Encryption | AES-256-GCM |
| IV | 16 bytes random (per session) |

> **WARNING**: Without the Panic Password, encrypted data is **permanently lost**. There is no recovery mechanism.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ • **Docker** & Docker Compose • **npm**

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
curl -fsSL https://raw.githubusercontent.com/florianjs/opentracker/main/scripts/install.sh -o install.sh
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
- Set up Prometheus + Grafana monitoring

> **Monitoring**: After installation, Grafana is accessible at `https://monitoring.your-domain.com/grafana`
>
> Default credentials: `admin` / `admin` (you'll be prompted to change on first login)
> Having issues with the password ? Just launch :

```bash
cd /opt/opentracker
docker exec -it opentracker-grafana grafana cli admin reset-admin-password <new-password>
```

![Grafana Dashboard](/public/images/grafana.png)

### Option 2: Development with Docker

> Databases are only exposed to the container network for security.

```bash
# Clone repository
git clone https://github.com/florianjs/opentracker.git && cd opentracker
cp .env.example .env

# Start all services (app + postgres + redis)
docker compose up -d

# View logs
docker compose logs -f app
```

**Open [http://localhost:3000](http://localhost:3000)**

![Torrent List](/public/images/image.png)
![Torrent Details](/public/images/image%20copy%202.png)

---

## 🔒 Security

> **For production, always use the install script** to ensure proper secret generation and security configuration.

### Key Security Features

| Layer              | Protection                                                 |
| ------------------ | ---------------------------------------------------------- |
| **Authentication** | ZKE, PoW anti-abuse, session encryption, CSRF protection   |
| **Database**       | SCRAM-SHA-256 auth, TLS, prepared statements, pool limits  |
| **Redis**          | Password auth, command restrictions, memory limits         |
| **Network**        | Rate limiting, auto IP bans, attack pattern detection      |
| **Privacy**        | SHA-256 hashed IPs, no raw IP persistence, minimal logging |

### Rate Limits

| Endpoint   | Limit   | Ban on Abuse                    |
| ---------- | ------- | ------------------------------- |
| Public API | 100/min | 100+ req/10s → auto-block       |
| Mutations  | 10/min  | Progressive penalties           |
| Auth       | 5/5min  | IP blacklisted after violations |
| Tracker    | 200/min | Distributed sliding window      |

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
| Frontend | Nuxt 3, Vue 3, Tailwind CSS         | SSR, Composition API                |
| Backend  | Nitro Server Engine                 | API routes, middleware              |
| Database | PostgreSQL 16 + Drizzle ORM         | Data persistence, full-text search  |
| Cache    | Redis 7                             | Peer lists, sessions, rate limiting |
| P2P      | bittorrent-tracker                  | HTTP & WebSocket announces          |
| Crypto   | Web Crypto API, scrypt, AES-256-GCM | ZKE auth, Panic encryption          |
| Monitor  | Prometheus + Grafana                | Metrics, dashboards, alerting       |

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
docker exec opentracker-db pg_isready           # PostgreSQL
docker exec opentracker-redis redis-cli ping    # Redis
```

### Updating

To update your OpenTracker installation to the latest version:

```bash
cd /opt/opentracker
git checkout main
git pull origin main
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

> **Note**: This will rebuild the containers with the latest code. Your data (PostgreSQL, Redis) is persisted in Docker volumes and will not be affected.

### Troubleshooting

**Full restart (stop and start all services):**

```bash
cd /opt/opentracker
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

**Full restart with rebuild (if you suspect issues with cached images):**

```bash
cd /opt/opentracker
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

**View logs to debug issues:**

```bash
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs -f app  # App only
```

---

## 🧪 Development

```bash
npm run dev              # Start dev server (HMR)
npm run build            # Production build
npx drizzle-kit push     # Push schema changes
npx drizzle-kit studio   # Database GUI
```

![Forum](/public/images/image%20copy%203.png)

![User Profile](/public/images/image%20copy%204.png)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

---

## 🙏 Acknowledgements

OpenTracker is built on the shoulders of giants. We'd like to thank the following open source projects:

| Project                                                                | Role                        |
| ---------------------------------------------------------------------- | --------------------------- |
| [Nuxt](https://nuxt.com)                                               | Fullstack Vue framework     |
| [Vue.js](https://vuejs.org)                                            | Reactive frontend framework |
| [bittorrent-tracker](https://github.com/webtorrent/bittorrent-tracker) | BitTorrent tracker library  |
| [Drizzle ORM](https://orm.drizzle.team)                                | TypeScript ORM              |
| [PostgreSQL](https://www.postgresql.org)                               | Database                    |
| [Redis](https://redis.io)                                              | In-memory cache             |
| [ioredis](https://github.com/redis/ioredis)                            | Redis client for Node.js    |
| [Tailwind CSS](https://tailwindcss.com)                                | Utility-first CSS           |
| [Chart.js](https://www.chartjs.org)                                    | Charts & visualizations     |
| [Prometheus](https://prometheus.io)                                    | Metrics collection          |
| [Grafana](https://grafana.com)                                         | Monitoring dashboards       |
| [VitePress](https://vitepress.dev)                                     | Documentation framework     |
| [Vitest](https://vitest.dev)                                           | Testing framework           |
| [Pinia](https://pinia.vuejs.org)                                       | State management            |
| [Zod](https://zod.dev)                                                 | Schema validation           |

---


---


---


---


---


---


---

<!-- CONTRIBUTORS:START -->
## 👥 Contributors

Thanks to all our contributors! Sorted by number of commits.

| Avatar | Contributor | Commits |
|:------:|-------------|:-------:|
| <img src="https://github.com/.png" width="40" height="40" style="border-radius:50%"> | **[github-actions[bot]](https://github.com/)** | 5 |<!-- CONTRIBUTORS:END -->

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ❤️ for the P2P community**

[Back to top](#-opentracker)

</div>
