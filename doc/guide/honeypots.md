# Honeypots

Trackarr sets traps that no real member ever touches. Anything that walks into one is a bot or a scanner: it is refused, the admins are alerted and, for trap paths, its IP is blocked for a while. Nothing needs to be configured.

## Trap paths

Trackarr serves no PHP, no WordPress and no dotfiles. A request for one of these paths can only come from a scanner looking for something to exploit:

| Trap | Examples |
| ---- | -------- |
| Dotfiles and VCS metadata | `/.env`, `/.git/config`, `/.aws/credentials`, `/.htpasswd`, `/.ssh/` |
| Admin panels of other apps | `/wp-admin`, `/wp-content`, `/phpmyadmin`, `/cgi-bin`, `/vendor/phpunit`, `/actuator` |
| Scripts of other stacks | any path ending in `.php`, `.asp`, `.aspx`, `.jsp`, `.cgi` |
| System files and appliance exploits | `/etc/…`, `/proc/…`, `/server-status`, `/hnap1` |

When one is requested:

1. The answer is a plain `404 Page not found`, like any missing page: the scanner learns nothing.
2. A `honeypot_triggered` security alert is raised (IP, path, user agent).
3. The IP is blocked for 5 minutes. Each new probe after that starts a new 5-minute block.

Set `HONEYPOT_BAN=false` to keep the alerts without blocking (useful behind a proxy that hides the real client IP, see [Environment variables](/reference/env#security-alerts)).

## Hidden form field

The login and registration forms carry an extra field, invisible to people and skipped by password managers (its name means nothing to them). Bots filling every input fill it too:

- **Login**: refused exactly like a wrong password (`401 Invalid credentials`), so the bot cannot tell it was spotted.
- **Registration**: refused (`400 Registration failed`), no account is created.

Both raise a `honeypot_triggered` alert with the username the bot tried.

## Where to see the hits

- **Admin dashboard → Security alerts**: every honeypot hit, next to brute force attempts, blocked IPs and suspected ratio cheats.
- **Webhooks**: set `DISCORD_WEBHOOK_URL`, `SLACK_WEBHOOK_URL` or `SECURITY_WEBHOOK_URL` to be notified (production only, unless `ENABLE_DEV_ALERTS=true`). The same alert is sent at most once every 5 minutes per IP, across all app nodes (the cooldown is shared through Redis; if Redis is down, each node applies it on its own).

## Why it helps

Scanners probe thousands of sites with the same list of paths. Blocking them on the first probe stops the rest of their run (login brute force, injection attempts) before it starts, and the alerts show who is knocking.
