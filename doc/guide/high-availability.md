# High Availability

Run Trackarr on several servers in different datacenters: if one goes down, another takes over with the same data.

> [!NOTE]
> This is an advanced setup. A single server with good [backups](./backup-restore.md) is enough for most trackers.

## How it works

Three sites, connected by a private network (WireGuard recommended):

| Site | Runs | Role |
| --- | --- | --- |
| **dc1** | app, PostgreSQL, Redis, etcd, Sentinel | Active site (initial primary) |
| **dc2** | app, PostgreSQL, Redis, etcd, Sentinel | Standby, replicates dc1 continuously |
| **dc3** | etcd, Sentinel | Witness: a small VPS that only votes |

- **PostgreSQL** runs under [Patroni](https://patroni.readthedocs.io) ([Spilo](https://github.com/zalando/spilo) image) with streaming replication. etcd (one member per site) decides which node is primary.
- **Redis** is a master/replica pair watched by three **Sentinels** (quorum 2).
- **Uploads** (avatars, logo, favicon) are stored in PostgreSQL, so replication carries them.
- **The app** connects to every PostgreSQL node (`target_session_attrs=primary`) and to the Sentinels: after a failover it finds the new primaries on its own.
- **Torrent clients** get every site's tracker in the `.torrent` file (`announce-list` tiers): when the first one does not answer, they move to the next one by themselves.

::: tip Why a third site?
With only two sites, a network cut between them looks like a crash to both: each would promote itself and the data would diverge (*split brain*). The witness breaks the tie: only the side that still reaches a majority (2 of 3) can be primary.
:::

## Requirements

- 3 machines in 3 different datacenters (the witness can be tiny: 1 vCPU, 512 MB)
- A private network between them, e.g. WireGuard `10.8.0.1`, `10.8.0.2`, `10.8.0.3`
- Docker with the Compose plugin on each
- A firewall that keeps the data ports private:

```bash
# On every site: only the web, the tracker and WireGuard are public
ufw default deny incoming
ufw allow 22/tcp
ufw allow 80,443/tcp
ufw allow 51820/udp            # WireGuard
ufw allow in on wg0            # etcd, PostgreSQL, Redis, Sentinel between sites
```

::: danger
Never expose ports 2379/2380 (etcd), 5432 (PostgreSQL), 8008 (Patroni), 6379 (Redis) or 26379 (Sentinel) on a public interface.
:::

## Setup

On each site, copy the `docker/ha/` directory and create its `.env` from `docker/ha/.env.example`:

- `NODE_NAME` and `NODE_IP` change per site
- `COMPOSE_PROFILES=node` on dc1 and dc2, empty on the witness
- `TRACKER_DOMAIN` is this site's tracker hostname (`tracker1.example.com` on dc1, `tracker2.example.com` on dc2)
- Everything else (passwords, host lists, `TRACKER_HTTP_URL`, `TRACKER_BACKUP_HTTP_URLS`) is **identical on every site**

Start the sites **in this order**, so dc1 bootstraps the cluster:

```bash
# 1. Witness (dc3)
docker compose up -d

# 2. dc1: wait until it is the PostgreSQL leader
docker compose up -d
docker compose exec postgres patronictl list

# 3. dc2: joins as a replica
docker compose up -d
docker compose exec postgres patronictl list   # dc2 shows "streaming"
```

On first start, `db-init` creates the application role and database on the primary. App nodes apply schema migrations one at a time (advisory lock), whichever starts first.

## Public endpoints

**Tracker**: nothing to switch. Each site serves its own tracker hostname, and every downloaded `.torrent` lists them in order:

```
TRACKER_HTTP_URL=https://tracker1.example.com/announce
TRACKER_BACKUP_HTTP_URLS=https://tracker2.example.com/announce
```

Only torrents downloaded after this is set carry the backup tracker: ask members to re-download, or announce it.

**Website**: point the main domain at the active site with a DNS provider that supports health-checked failover (Cloudflare Load Balancing, AWS Route 53, NS1, Bunny DNS…), checking `https://<site>/api/health` with a short TTL (30-60s). Any provider works; pick the one you already use.

::: warning HTTPS on the standby
Caddy on dc2 can only obtain the certificate for the main domain once DNS points to it, which adds ~30s to a failover. The tracker hostnames are not affected: each site always holds its own certificate.
:::

## What happens when a datacenter goes down

Measured with the local test (`docker/ha/test/failover-test.sh`), dc1 cut off the network:

| Step | Time |
| --- | --- |
| PostgreSQL promoted on dc2 | ~25s |
| Redis promoted on dc2 | ~1s |
| App on dc2 healthy on the new primaries | ~105s total |
| Torrent clients | switch at their next announce |

- No member data is lost in the test, but replication is **asynchronous**: in a real crash, the last second or so of writes may not have reached dc2 (some upload/download stats, a message).
- Peer lists start empty on dc2 and fill up as clients announce. Ratios are not affected: accounting is in PostgreSQL and Redis.
- When dc1 comes back, it rejoins automatically as a replica and catches up.

## Switching back

Once dc1 is healthy again, move the primaries back during a quiet moment:

```bash
# PostgreSQL: hand the primary role back to dc1
docker compose exec postgres patronictl switchover --candidate <dc1-member-name>

# Redis: force a failover (Sentinel picks the replica, now dc1)
docker compose exec sentinel redis-cli -p 26379 sentinel failover mymaster
```

Then point the main domain back to dc1 if your DNS does not do it automatically.

## Monitoring

```bash
docker compose exec postgres patronictl list                                   # roles and replication lag
docker compose exec sentinel redis-cli -p 26379 sentinel get-master-addr-by-name mymaster
docker compose exec etcd etcdctl endpoint health --cluster
```

## Migrating an existing installation

1. Set up the three sites as above (fresh cluster).
2. Put the old server in maintenance and dump its database: `pg_dump -Fc`.
3. Restore into the new primary: `pg_restore --no-owner --role=<DB_USER> -d <DB_NAME>`.
4. Copy the old `uploads` volume into `uploads_data` on dc1: the app imports those files into the database at startup.
5. Reuse the old `NUXT_SESSION_SECRET` and `IP_HASH_SECRET` so sessions and passkeys keep working.

## Limitations

- **Active/passive**: one site serves at a time. Peer lists live in each app's memory, so spreading announces over both sites would split swarms.
- Asynchronous replication (see above).
- Redis holds short-lived data (peer state, rate limits, caches): a failover may reset some of it.

## Testing locally

The whole scenario runs on one machine:

```bash
docker build -t trackarr:ha-test --build-arg TRACKER_HTTP_URL=http://tracker1.test/announce .
docker/ha/test/failover-test.sh
```

It starts three simulated sites, writes through dc1, cuts dc1 off, checks that dc2 takes over with the data, then reconnects dc1.
