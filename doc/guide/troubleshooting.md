# Troubleshooting

Common issues and how to resolve them.

## Installation Issues

### SSL Certificate Fails to Generate

**Symptoms:** The installer fails with certificate errors during Let's Encrypt setup.

**Causes:**

- DNS not properly configured
- DNS propagation not complete
- Ports 80/443 blocked by firewall

**Solutions:**

1. Verify DNS records are correct:

   ```bash
   dig tracker.your-domain.com +short
   dig announce.your-domain.com +short
   dig monitoring.your-domain.com +short
   ```

   Each should return your VPS IP address.

2. Check if ports are open:

   ```bash
   sudo ufw status
   # Or for iptables:
   sudo iptables -L -n
   ```

3. Wait for DNS propagation (up to 24-48 hours, usually a few minutes).

4. Run the installer again after fixing the issue.

---

### Docker Build Fails

**Symptoms:** `docker compose up -d --build` fails with errors.

**Solutions:**

1. Clear Docker cache and rebuild:

   ```bash
   docker system prune -a
   docker compose -f docker-compose.prod.yml build --no-cache
   docker compose -f docker-compose.prod.yml up -d
   ```

2. Check available disk space:

   ```bash
   df -h
   ```

3. Ensure Docker is running:
   ```bash
   sudo systemctl status docker
   ```

---

## Runtime Issues

### Application Won't Start

**Symptoms:** Container keeps restarting or exits immediately.

**Solutions:**

1. Check container logs:

   ```bash
   docker compose -f docker-compose.prod.yml logs -f app
   ```

2. Verify environment variables are set:

   ```bash
   docker compose -f docker-compose.prod.yml config
   ```

3. Check database connectivity:

   ```bash
   docker exec trackarr-db pg_isready
   ```

4. Check Redis connectivity:
   ```bash
   docker exec trackarr-redis redis-cli ping
   ```

---

### Database Connection Errors

**Symptoms:** "Connection refused" or "ECONNREFUSED" errors.

**Solutions:**

1. Verify database container is running:

   ```bash
   docker ps | grep trackarr-db
   ```

2. Check database logs:

   ```bash
   docker compose -f docker-compose.prod.yml logs db
   ```

3. Restart the database:

   ```bash
   docker compose -f docker-compose.prod.yml restart db
   ```

4. Verify `DATABASE_URL` format:
   ```
   postgresql://user:password@db:5432/dbname
   ```

---

### PgBouncer Configuration Error

**Symptoms:** PgBouncer fails to start with `syntax error in configuration`.

```
ERROR syntax error in configuration (/etc/pgbouncer/pgbouncer.ini:3), stopping loading
FATAL cannot load config file
```

The generated config shows something like:

```ini
[databases]
e21V5@postgres:5432/trackarr = host=postgres port=5432 auth_user=tracker
```

**Cause:** Your `DB_PASSWORD` contains special characters (`@`, `:`, `/`, `#`) that break the `DATABASE_URL` parsing in the PgBouncer image.

**Solutions:**

1. **Regenerate a clean password** (alphanumeric only):

   ```bash
   openssl rand -base64 32 | tr -d '/+=@:#' | head -c 32
   ```

2. **Update your configuration** with the new password:

   ```bash
   # Update .env
   sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=NEW_PASSWORD_HERE/" .env

   # Update secrets file if used
   echo -n "NEW_PASSWORD_HERE" > secrets/db_password.txt
   ```

3. **Update the PostgreSQL user password**:

   ```bash
   docker exec -it trackarr-db psql -U postgres -c "ALTER USER tracker WITH PASSWORD 'NEW_PASSWORD_HERE';"
   ```

4. **Restart affected services**:
   ```bash
   docker compose -f docker-compose.prod.yml restart postgres pgbouncer app
   ```

**Alternative:** Re-run `./scripts/install.sh` which automatically generates safe passwords.

---

### Redis Connection Errors

**Symptoms:** Session errors, rate limiting not working, "ECONNREFUSED" to Redis.

**Solutions:**

1. Verify Redis container is running:

   ```bash
   docker ps | grep trackarr-redis
   ```

2. Test Redis connection:

   ```bash
   docker exec trackarr-redis redis-cli ping
   # Should return: PONG
   ```

3. Check Redis password matches `.env`:
   ```bash
   docker exec trackarr-redis redis-cli -a YOUR_PASSWORD ping
   ```

---

## Tracker Issues

### Torrents Show 0 Seeders/Leechers

**Symptoms:** Torrent pages display "0 seeders / 0 leechers" despite active peers.

**Causes:**

- The `tracker` service is not running (with `NODE_ENV=production` it refuses to start without an `IP_HASH_SECRET` of at least 32 characters)
- The tracker just started without a snapshot (crash, failover, first start): counters are published only after the warm-up (`TRACKER_WARMUP`, ~11 minutes by default), then every 60 s. Until then the site keeps the last published counters (none on a fresh install). A graceful restart reloads its swarm snapshot and publishes right away.
- Peers not announcing correctly
- Redis cache issues

**Solutions:**

1. Verify `IP_HASH_SECRET` is set in your `.env` file.

2. Check the tracker status (`GET /api/admin/debug/tracker-status` as admin). `unreachable` means the app cannot reach the tracker's private API: check that `TRACKER_INTERNAL_TOKEN` is set in `.env`.

3. Restart the tracker:

   ```bash
   docker compose -f docker-compose.prod.yml restart tracker
   ```

4. Check tracker logs (`TRACKER_DEBUG=true` for more detail):
   ```bash
   docker compose -f docker-compose.prod.yml logs -f tracker
   ```

---

### Announce URL Not Working

**Symptoms:** Torrent clients show "tracker offline" or connection errors.

**Solutions:**

1. Verify announce domain DNS:

   ```bash
   dig announce.your-domain.com +short
   ```

2. Test announce endpoint:

   ```bash
   curl -I https://announce.your-domain.com/announce
   ```

3. Check Caddy logs for SSL issues:
   ```bash
   docker compose -f docker-compose.prod.yml logs caddy
   ```

---

## Authentication Issues

### "Invalid or Expired Challenge"

**Symptoms:** Login fails with "Invalid or expired challenge" error.

**Causes:**

- Session expired during login
- Clock skew between client and server
- Redis session storage issues

**Solutions:**

1. Refresh the page and try again.

2. Clear browser cache and cookies.

3. Check Redis is running and accessible.

4. Verify server time is correct:
   ```bash
   date
   timedatectl
   ```

---

### Can't Register First Admin

**Symptoms:** Registration form doesn't appear or fails.

**Solutions:**

1. Ensure no users exist in the database (first user becomes admin).

2. Check for JavaScript errors in browser console.

3. Verify the PoW challenge is completing:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f app | grep challenge
   ```

---

## Monitoring Issues

### Beszel Shows No System / Agent Not Running

**Symptoms:** Beszel loads but lists no system, or the system stays down.

**Causes:**

- The agent was never paired: it exits without a key
- `COMPOSE_PROFILES=monitoring` is missing from `.env`, so the agent is not started

**Solutions:**

1. Pair the agent as described in [Monitoring](/guide/monitoring#pairing-the-agent) (host `/beszel_socket/beszel.sock`), and check `.env`:

   ```
   BESZEL_AGENT_KEY=...
   BESZEL_AGENT_TOKEN=...
   COMPOSE_PROFILES=monitoring
   ```

2. Start it and check its logs:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   docker logs trackarr-beszel-agent
   ```

---

### Forgot Monitoring Basic Auth Password

**Solutions:**

Generate a new hash and put it in `.env` as `MONITORING_PASSWORD_HASH`, doubling every `$` (`$$`) for Docker Compose:

```bash
printf '%s\n' '<new-password>' | docker run --rm -i caddy:2-alpine caddy hash-password
docker compose -f docker-compose.prod.yml up -d caddy
```

---

## Performance Issues

### Slow Page Loads

**Solutions:**

1. Check system resources:

   ```bash
   htop
   docker stats
   ```

2. Increase Redis memory if needed (in `docker-compose.prod.yml`).

3. Check for long-running database queries:
   ```bash
   docker exec trackarr-db psql -U tracker -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
   ```

---

### High Memory Usage

**Solutions:**

1. Set memory limits in Docker Compose:

   ```yaml
   services:
     app:
       deploy:
         resources:
           limits:
             memory: 512M
   ```

2. Restart containers to free memory:
   ```bash
   docker compose -f docker-compose.prod.yml restart
   ```

---

## Common Commands

### Full Restart

```bash
cd /opt/trackarr
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Restart with Rebuild

```bash
cd /opt/trackarr
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

### View All Logs

```bash
docker compose -f docker-compose.prod.yml logs -f
```

### View Specific Service Logs

```bash
docker compose -f docker-compose.prod.yml logs -f app    # Application
docker compose -f docker-compose.prod.yml logs -f tracker # Tracker
docker compose -f docker-compose.prod.yml logs -f db     # PostgreSQL
docker compose -f docker-compose.prod.yml logs -f redis  # Redis
docker compose -f docker-compose.prod.yml logs -f caddy  # Reverse proxy
```

### Check Container Health

```bash
docker ps
docker compose -f docker-compose.prod.yml ps
```

### Database Backup

```bash
docker exec trackarr-db pg_dump -U tracker trackarr > backup.sql
```

### Database Restore

```bash
cat backup.sql | docker exec -i trackarr-db psql -U tracker trackarr
```

## Still Need Help?

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/florianjs/trackarr/issues) for similar problems
2. Open a new issue with:
   - Description of the problem
   - Relevant log output
   - Your environment (OS, Docker version)
   - Steps to reproduce
3. [Get professional support](/support/professional) if you need hands-on help
