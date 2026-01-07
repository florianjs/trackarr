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

| Data Type | Encryption |
|-----------|------------|
| `.torrent` files | AES-256-GCM (completely unusable) |
| Torrent metadata | Names replaced with `[ENCRYPTED]` |
| File sizes | Set to 0 |
| User auth data | Encrypted |
| Forum posts | Content encrypted |
| Private messages | Encrypted |

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
| IV | 16 bytes random (per encryption session) |
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
