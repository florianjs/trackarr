# Panic Mode

The **Panic Button** allows administrators to **instantly encrypt all sensitive data** in an emergency. Once activated, all torrent files become unusable and user data is unreadable.

## How It Works

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
│  • Posts, messages, IPs → Encrypted                               │
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

## Setup

### Setting the Panic Password

The **first administrator** must set a Panic Password during initial setup.

::: danger Critical
Without the Panic Password, encrypted data is **permanently lost**. There is no recovery mechanism, backdoor, or master key.
:::

## Activation

To activate Panic Mode:

1. Go to **Admin Settings** → **Panic Mode**
2. Confirm with the Panic Password

Encryption begins immediately and cannot be interrupted.

## What Gets Encrypted

Everything below is encrypted in a single database transaction: a crash midway leaves the data unchanged.

| Data | Columns |
|------|---------|
| `.torrent` files | Raw file (completely unusable) |
| Torrents | Name, description; size (set to 0), category, IMDb/TMDB/TVDB ids (cleared, kept encrypted) |
| Users | Passkey, auth salt and verifier, last IP |
| Forum | Topic titles, post content |
| Torrent comments | Content |
| Private messages | Message body |
| Shoutbox | Message body (deleted messages included) |
| Banned IPs | IP and reason |
| Reports | Reason, details, resolution |
| Bounties | Title, description, IMDb id |
| Bonus ledger | Transaction descriptions (they hold torrent names and bounty titles) |

### What Gets Deleted

Logs that hold passkeys or IPs are deleted from Redis, not encrypted, and are **not restored**:

| Redis key | Content |
|-----------|---------|
| `torznab:logs`, `torznab:user:logs:*` | Torznab requests: passkey, IP, query, user agent |
| `torznab:user:stats` | Torznab usage per passkey |
| `torznab:blocked` | Torznab blocks per passkey (blocked users must be blocked again) |
| `security:alerts` | Admin alert inbox (IPs, user agents); webhooks already received them |
| `tracker:abuse_events` | Pending tracker abuse events (IPs) |

### What Stays in Clear

- Usernames, roles, ratios, bonus points and timestamps
- Info hashes: the tracker and torrent stats reference them
- Relations (who wrote what, who talks to whom, invitations)
- Settings, uploaded images, tags and categories
- Rate-limit and DDoS keys in Redis (`ratelimit:*`, `ddos:*`): they expire within 24 hours and protect the restore endpoint against brute force
- The tracker service's memory: peers (with their IPs) expire after their announce interval; a snapshot file holding them is written only on shutdown

### While Encrypted

The site keeps running, but nobody can log in (verifiers are encrypted) and the tracker refuses every announce (passkeys are encrypted). IP bans are inactive since banned IPs are encrypted too. Members already logged in may keep posting: posts, comments, messages and shouts written meanwhile stay in clear and are kept as is on restore.

## Restoration

To restore from Panic Mode:

1. Go to **Admin Settings** → **Panic Mode**
2. Enter the original Panic Password
3. Click **Restore**

The system will decrypt all data and return to normal operation.

## Encryption Details

| Component | Algorithm |
|-----------|-----------|
| Key Derivation | scrypt (32 bytes output) |
| Encryption | AES-256-GCM |
| IV | 12 bytes random, per value |
| Authentication | GCM tag (prevents tampering) |

## Use Cases

Panic Mode is designed for scenarios where data protection is paramount:

- **Server compromise** — Render stolen data useless
- **Shutdown** — Secure cleanup when closing the tracker
- etc.

## Best Practices

1. **Test restoration** — Practice the restore process BEFORE you need it
2. **Multiple backups** — Store the Panic Password in multiple secure locations
3. **Password managers** — Use a password manager for the Panic Password
