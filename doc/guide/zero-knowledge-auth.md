# Zero-Knowledge Authentication

Trackarr uses a **Zero-Knowledge** authentication system where the server **never sees or stores your password**. All cryptographic operations happen client-side in your browser.

## How It Works

### Registration Flow

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
```

### Login Flow

```
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

## Key Security Properties

### Password Never Transmitted

Your password never leaves your device. The browser derives a verifier from it (PBKDF2, then SHA-256) and only that verifier is sent, over TLS. The server never sees, logs or stores your password.

### PBKDF2 with 100k Iterations

Password-Based Key Derivation Function 2 (PBKDF2) with 100,000 iterations makes brute-force attacks computationally expensive. Each password guess requires significant CPU time.

### Unique Challenge Per Login

Every login attempt receives a unique, time-limited, single-use challenge, which also carries the account's salt. Unknown usernames get a decoy salt and challenge, and failed logins cost the same time whether the account exists or not, so the login form never reveals which accounts exist.

### Proof of Work

Registration requires solving a computational puzzle (Proof of Work). This:

- Prevents automated account creation
- Stops spam registrations
- Makes bot attacks expensive

## What the Server Stores

The server only stores:

| Data | Purpose |
|------|---------|
| Username | Account identification |
| Salt | Random bytes for key derivation |
| Verifier hash | scrypt hash (random salt) of the verifier |

::: tip
The verifier itself is never stored: a database copy cannot be replayed to log in. To use it, an attacker has to guess each password through PBKDF2 (100,000 iterations) and scrypt.
:::

## Comparison with Traditional Auth

| Aspect | Traditional | Zero-Knowledge |
|--------|-------------|----------------|
| Password storage | Hashed on server | Never reaches server |
| Network exposure | Password sent over TLS | Only a derived verifier sent over TLS |
| Database breach risk | Password hashes exposed | Hashes of derived verifiers exposed |
| Server trust required | High | Minimal |
