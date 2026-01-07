# Backup & Restore

This guide covers backing up your OpenTracker database and restoring it on a new server.

## Why Backup?

::: warning Critical
It is **strongly recommended** to back up your PostgreSQL database to **multiple locations**. If a node fails, having backups in different locations (off-site storage, cloud providers, separate servers) ensures you can recover your data.
:::

## Backup Strategy

- **Regular automated backups** — Set up daily or hourly `pg_dump` backups
- **Multiple destinations** — Store copies on at least 2-3 different locations
- **Test your restores** — Periodically verify that backups can be restored successfully
- **Encrypt backups** — Always encrypt backups before storing them off-site

### Creating a Database Backup

```bash
cd /opt/opentracker
docker compose exec db pg_dump -U opentracker opentracker | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

### Backing Up Secrets

::: danger Don't forget your .env file
Your `.env` file contains critical secrets that **cannot be regenerated**. If you lose these, all existing passkeys and user sessions will be invalidated.
:::

Always back up your `.env` file alongside your database:

```bash
cd /opt/opentracker
cp .env .env.backup_$(date +%Y%m%d_%H%M%S)
```

Key secrets to preserve:

| Variable | Purpose |
|----------|---------|
| `TRACKER_SECRET` | Generates user passkeys — losing this invalidates all `.torrent` files |
| `IP_HASH_SECRET` | Hashes peer IPs — losing this breaks peer tracking continuity |
| `NUXT_SESSION_PASSWORD` | Encrypts sessions — losing this logs out all users |

Store a copy of your `.env` file in a secure location (password manager, encrypted storage) separate from your database backups.

## Restoring a Backup

To restore your database on a new VPS:

**1. Install OpenTracker on the new server**

Run the installer as usual:

```bash
curl -fsSL https://raw.githubusercontent.com/florianjs/opentracker/main/scripts/install.sh -o install.sh
chmod +x install.sh
sudo ./install.sh
```

**2. Stop the application**

```bash
cd /opt/opentracker
docker compose -f docker-compose.prod.yml down
```

**3. Transfer your backup file to the new server**

```bash
# From your old server or local machine
scp backup_20260102_120000.sql.gz user@new-server:/opt/opentracker/
```

**4. Start only the database container**

```bash
cd /opt/opentracker
docker compose -f docker-compose.prod.yml up -d db
```

**5. Restore the backup**

```bash
# Drop and recreate the database
docker compose exec db dropdb -U opentracker opentracker
docker compose exec db createdb -U opentracker opentracker

# Restore from backup
gunzip -c backup_20260102_120000.sql.gz | docker compose exec -T db psql -U opentracker opentracker
```

**6. Start all services**

```bash
docker compose -f docker-compose.prod.yml up -d
```

::: tip
Make sure to update your `.env` file on the new server with the same secrets (`TRACKER_SECRET`, `IP_HASH_SECRET`, `NUXT_SESSION_PASSWORD`) from your old installation, otherwise existing passkeys and sessions will be invalidated.
:::

## Changing Domains

If you're migrating to a new domain (e.g., `old-tracker.com` → `new-tracker.com`):

**1. Update DNS records**

Create A records for your new domain pointing to your server's IP:

| Subdomain | Record Type | Value |
|-----------|-------------|-------|
| `tracker.new-domain.com` | A | Your VPS IP |
| `announce.new-domain.com` | A | Your VPS IP |
| `monitoring.new-domain.com` | A | Your VPS IP |

**2. Update environment variables**

Edit your `.env` file:

```bash
cd /opt/opentracker
nano .env
```

Update these values:

```env
DOMAIN=new-domain.com
NUXT_PUBLIC_SITE_URL=https://tracker.new-domain.com
NUXT_PUBLIC_ANNOUNCE_URL=https://announce.new-domain.com
```

**3. Regenerate SSL certificates**

Delete the old Caddy data to force new certificate generation:

```bash
docker compose -f docker-compose.prod.yml down
docker volume rm opentracker_caddy_data || true
docker compose -f docker-compose.prod.yml up -d
```

Caddy will automatically obtain new Let's Encrypt certificates for your new domains.

::: warning
Changing the announce URL will invalidate all existing `.torrent` files and magnet links. Users will need to re-download torrent files with the new announce URL.
:::
