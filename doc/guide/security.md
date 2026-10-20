# Security Overview

Trackarr is built with security as a foundational principle, not an afterthought. This page provides an overview of the security architecture.

## Security Layers

| Layer | Protection |
|-------|------------|
| **Authentication** | Zero-Knowledge proofs, PoW anti-abuse, session encryption, CSRF protection |
| **Database** | SCRAM-SHA-256 auth, TLS, prepared statements, connection pool limits |
| **Redis** | Password auth, command restrictions, memory limits |
| **Network** | Rate limiting, auto IP bans, attack pattern detection |
| **Privacy** | SHA-256 hashed IPs, no raw IP persistence, minimal logging |

## Rate Limits

Trackarr implements distributed rate limiting to prevent abuse:

| Endpoint | Limit | Action on Abuse |
|----------|-------|-----------------|
| Public API | 100/min | 100+ req/10s → auto-block |
| Mutations | 10/min | Progressive penalties |
| Auth | 5/5min | IP blacklisted after violations |
| Tracker | 200/min | Distributed sliding window |

## Sessions

Sessions are sealed (encrypted) cookies valid 7 days. Each one carries the account's
`session_version` from sign-in, checked against the database on every authenticated request:
when the version changes, every older cookie is rejected at once (`401`) on every node.
A banned account is refused with `403` for as long as the ban lasts.

The version is bumped when:

- a moderator or admin bans the account (sessions stay revoked after an unban)
- the user clicks **Sign out other devices** in the account menu (the current session is kept)

Panic mode does not sign anyone out: the admin needs their session to reach the restore form, since nobody can log in while verifiers are encrypted.

## IP Privacy

User IP addresses are **never stored in plaintext**. Instead:

1. IPs are hashed using SHA-256 with a secret salt
2. Only the hash is stored for rate limiting and abuse detection
3. Hashes cannot be reversed to obtain the original IP
4. Logs are minimal and do not contain identifying information

## Attack Detection

The system automatically detects and blocks:

- SQL injection attempts
- XSS (Cross-Site Scripting) attacks
- Path traversal attempts
- Brute force authentication attempts
- Automated scraping and enumeration

## Learn More

- [Zero-Knowledge Authentication](/guide/zero-knowledge-auth) — How passwords are never transmitted
- [Panic Mode](/guide/panic-mode) — Emergency data encryption
