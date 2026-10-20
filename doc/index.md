---
layout: home

hero:
  name: Trackarr
  text: Modern Private BitTorrent Tracker
  tagline: High-performance, security-first tracker with Zero-Knowledge Authentication and Panic Mode encryption.
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/florianjs/trackarr
    - theme: alt
      text: Live Demo
      link: https://trackarr.florianargaud.com/

features:
  - title: Zero-Knowledge Auth
    details: Your password never leaves your device. All cryptographic operations happen client-side with PBKDF2 and challenge-response.
  - title: Lightning Fast
    details: In-memory swarms in the Rust tracker, Redis caching, PostgreSQL full-text search and optimized concurrent handling.
  - title: Panic Mode
    details: Instant AES-256-GCM encryption of all sensitive data. One click to protect everything, recoverable only with your password.
  - title: Security First
    details: Distributed rate limiting, auto IP bans, SQL/XSS detection, SHA-256 hashed IPs, and comprehensive attack pattern detection.
  - title: Dedicated Tracker
    details: A standalone Rust tracker service handles HTTP announces and scrapes, with swarms kept in memory and credit written to PostgreSQL in batches.
  - title: Built-in Monitoring
    details: Beszel for server and container stats with alerts, plus tracker health, growth charts and security alerts in the admin dashboard.
---

## Why Trackarr?

Trackarr is designed for communities that value **privacy** and **security** above all else. Unlike traditional trackers that store passwords and personal data in plaintext or with reversible encryption, Trackarr uses cryptographic proofs that make it mathematically impossible to recover user credentials—even for administrators.

### Tech Stack

| Layer    | Technology                          | Purpose                             |
| -------- | ----------------------------------- | ----------------------------------- |
| Frontend | Nuxt 4, Vue 3, Tailwind CSS         | SSR, Composition API                |
| Backend  | Nitro Server Engine                 | API routes, middleware              |
| Database | PostgreSQL 16 + Drizzle ORM         | Data persistence, full-text search  |
| Cache    | Redis 7                             | Swarm counters, sessions, rate limiting |
| P2P      | Rust tracker service (`tracker/`)   | HTTP announces & scrapes            |
| Crypto   | Web Crypto API, scrypt, AES-256-GCM | ZKE auth, Panic encryption          |
| Monitor  | Beszel + admin dashboard            | Host/container stats, alerting, app metrics |

---

## Need a Custom Setup?

Want a **custom installation**, specific features, or professional support for your private tracker?

I offer:

- **Custom Installation** — Turnkey setup on your infrastructure
- **Feature Development** — Custom features tailored to your community
- **Ongoing Maintenance** — Updates, backups, and monitoring
- **Performance Optimization** — Fine-tuning for high-traffic trackers

<div class="custom-cta">

**Let's talk:** [u68w37uj@exile.4wrd.cc](mailto:u68w37uj@exile.4wrd.cc) · [Discord](https://discord.gg/GRFu35djvz) · [argaudflorian.com](https://argaudflorian.com/)

</div>

<style>
:root {
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(135deg, #1f2937 0%, #6b7280 100%);
}

.dark {
  --vp-home-hero-name-background: linear-gradient(135deg, #f9fafb 0%, #9ca3af 100%);
}

.custom-cta {
  margin-top: 1.5rem;
  padding: 1.5rem 2rem;
  background: linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%);
  border-radius: 12px;
  text-align: center;
  border: none;
}

.dark .custom-cta {
  background: linear-gradient(135deg, #1f2937 0%, #374151 100%);
  /* border-color: #4b5563; */
}

.custom-cta a {
  color: #111827;
  font-weight: 600;
}

.dark .custom-cta a {
  color: #f9fafb;
}

.custom-cta a:hover {
  text-decoration: underline;
}
</style>
