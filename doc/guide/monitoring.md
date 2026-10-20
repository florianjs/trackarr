# Monitoring

Trackarr splits monitoring in two:

- **Server and containers** — [Beszel](https://beszel.dev) (hub + agent), served on your monitoring domain
- **Application and tracker figures** — the Trackarr admin dashboard

## Beszel

Beszel shows CPU, memory, disk, network and temperature for the host, plus per-container stats, with history. It also sends alerts (CPU, memory, disk, bandwidth, temperature, container status) through the notification channels you configure in its UI (email, webhooks via Shoutrrr, etc.).

The production stack runs three containers:

| Service        | Container               | Role                                                                 |
| -------------- | ----------------------- | -------------------------------------------------------------------- |
| `beszel`       | `trackarr-beszel`       | Hub and web UI (port 8090, reached through Caddy; outbound access for notifications) |
| `beszel-agent` | `trackarr-beszel-agent` | Collects host and container stats (host network, Compose profile `monitoring`) |
| `docker-proxy` | `trackarr-docker-proxy` | Read-only, filtered Docker API for the agent on `127.0.0.1:2375` (Compose profile `monitoring`) |

The hub and the agent talk through a shared unix socket (`/beszel_socket/beszel.sock`): no port is opened. The agent exits without a key, so it only starts once paired and `COMPOSE_PROFILES=monitoring` is set in `.env`.

### Access

| Environment                                   | URL                          |
| --------------------------------------------- | ---------------------------- |
| Production (`docker-compose.prod.yml`)        | `https://$MONITORING_DOMAIN` |
| Local production (`docker-compose.local.yml`) | `http://localhost:3001`      |

Log in with the Beszel account: the email and password in `.env` (`BESZEL_ADMIN_EMAIL` / `BESZEL_ADMIN_PASSWORD`), shown at the end of the install. Beszel creates this account on its first start, so nobody can claim the UI before you; Caddy also refuses the "create the first account" request from outside. On the local production stack (`localhost` only), you create the account on your first visit instead.

::: info Why there is no browser login prompt
Earlier versions put Caddy basic auth in front of Beszel. The Beszel UI sends its own token in the same `Authorization` header, which basic auth rejects: the browser kept asking for the password. Beszel's own login now protects it.
:::

::: details Forgot the password, or no Beszel account yet
`BESZEL_ADMIN_*` only apply on Beszel's first start: changing them later does nothing. Instead, create a Beszel superuser from the server:

```bash
docker exec trackarr-beszel /beszel superuser upsert you@example.com 'a-long-password'
```

Then open `https://monitoring.your-domain.com/_/`, log in with it, open the **users** collection, and edit your account's password (or create the account).
:::

### Pairing the agent

Do this once, after the first install (or after upgrading from Grafana). It connects the agent, which collects the stats, to the Beszel web UI. Until then, Beszel shows no system.

You need two windows: a **browser** for Beszel, and a **terminal on the server** for the agent.

#### 1. Log in to Beszel

Open `https://monitoring.your-domain.com` and log in with the monitoring login shown at the end of the install (also in `.env`: `BESZEL_ADMIN_EMAIL` / `BESZEL_ADMIN_PASSWORD`).

#### 2. Add the server in Beszel

1. Click **Add system** (top right).
2. Fill in the form:

   | Field     | Value                        |
   | --------- | ---------------------------- |
   | Name      | anything, e.g. `trackarr`    |
   | Host / IP | `/beszel_socket/beszel.sock` |

   The host is a socket shared by the two containers, not an address: the **Port** field disappears once you type it.
3. Below, the dialog shows a **public key** (starts with `ssh-ed25519`) and a **token**, each with a copy button. You will paste them on the server in the next step.
4. Click **Add system**. The system appears with a yellow dot: it is waiting for the agent.

#### 3. Start the agent on the server

Connect to the server and go to the Trackarr directory (`/opt/trackarr` when installed with `install.sh`):

```bash
ssh root@your-server
cd /opt/trackarr
sudo ./scripts/pair-monitoring.sh
```

Paste the public key, then the token, when asked. The script writes them to `.env`, turns the monitoring profile on, starts the agent and checks it stays up.

The dot turns green in Beszel within a minute.

::: details Doing it by hand instead
Open `.env` in the Trackarr directory (`nano .env`). The installer left three commented lines for the agent: uncomment them and fill in the values, without quotes:

```bash
BESZEL_AGENT_KEY=ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA...
BESZEL_AGENT_TOKEN=0d1e2f3a-...
COMPOSE_PROFILES=monitoring
```

Save (<kbd>Ctrl</kbd>+<kbd>O</kbd>, <kbd>Enter</kbd>, <kbd>Ctrl</kbd>+<kbd>X</kbd> in nano), then start the agent:

```bash
docker compose -f docker-compose.prod.yml up -d
```
:::

For the local production stack, run `./scripts/pair-monitoring.sh --local` (it uses `.env.local-prod`).

#### If the dot does not turn green

- Check the agent: `docker compose -f docker-compose.prod.yml ps beszel-agent` should say `running`.
- Read its logs: `docker compose -f docker-compose.prod.yml logs beszel-agent`. A key or token error means a copy/paste mistake: run the script again with the values from Beszel. To see them again, click **⋯** at the end of the system's row, then **Edit**.
- More cases in [Troubleshooting](/guide/troubleshooting).

The installers keep `BESZEL_AGENT_KEY`, `BESZEL_AGENT_TOKEN` and `COMPOSE_PROFILES` when you re-run them.

::: tip Docker socket
The agent never sees `/var/run/docker.sock`. It reads per-container stats and "container down" alerts through `docker-proxy`, which only lets container listing, stats, info and version requests through and refuses every write. To monitor the host only, set `DOCKER_HOST: ""` on the `beszel-agent` service.
:::

## Admin dashboard

Application and tracker figures live in the Trackarr admin dashboard:

- **Growth charts** — users, torrents, peers, Redis memory, database size, hourly activity
- **Tracker** card, refreshed every 30 seconds — status, announces per second (last minute), swarms, seeders, leechers, credit waiting to be written, uptime, and rejections (invalid passkeys, unknown torrents, too many peers, blocked clients). A notice is shown while the tracker warms up.
- **Security alerts** card

## Tracker `/metrics`

The tracker still exposes Prometheus-format metrics on its private port: `http://tracker:8090/metrics` inside Docker Compose (see [`tracker/README.md`](https://github.com/florianjs/trackarr/blob/main/tracker/README.md)). Nothing in the stack scrapes it any more; point your own Prometheus-compatible tooling at it if you want long-term tracker metrics.
