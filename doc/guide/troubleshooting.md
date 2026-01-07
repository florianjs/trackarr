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
   docker exec opentracker-db pg_isready
   ```

4. Check Redis connectivity:
   ```bash
   docker exec opentracker-redis redis-cli ping
   ```

---

### Database Connection Errors

**Symptoms:** "Connection refused" or "ECONNREFUSED" errors.

**Solutions:**

1. Verify database container is running:

   ```bash
   docker ps | grep opentracker-db
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
e21V5@postgres:5432/opentracker = host=postgres port=5432 auth_user=tracker
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
   docker exec -it opentracker-db psql -U postgres -c "ALTER USER tracker WITH PASSWORD 'NEW_PASSWORD_HERE';"
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
   docker ps | grep opentracker-redis
   ```

2. Test Redis connection:

   ```bash
   docker exec opentracker-redis redis-cli ping
   # Should return: PONG
   ```

3. Check Redis password matches `.env`:
   ```bash
   docker exec opentracker-redis redis-cli -a YOUR_PASSWORD ping
   ```

---

## Tracker Issues

### Torrents Show 0 Seeders/Leechers

**Symptoms:** Torrent pages display "0 seeders / 0 leechers" despite active peers.

**Causes:**

- `IP_HASH_SECRET` environment variable not set
- Peers not announcing correctly
- Redis cache issues

**Solutions:**

1. Verify `IP_HASH_SECRET` is set in your `.env` file.

2. Restart the application:

   ```bash
   docker compose -f docker-compose.prod.yml restart app
   ```

3. Check tracker logs for announce activity:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f app | grep tracker
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

### Grafana Shows Black Screen

**Symptoms:** Grafana dashboard loads but displays nothing.

**Causes:**

- Incorrect `GF_SERVER_ROOT_URL` configuration
- Grafana redirect loop

**Solutions:**

1. Verify `GF_SERVER_ROOT_URL` includes the full path:

   ```
   GF_SERVER_ROOT_URL=https://monitoring.your-domain.com/grafana
   ```

2. Restart Grafana:
   ```bash
   docker compose -f docker-compose.prod.yml restart grafana
   ```

---

### Forgot Grafana Password

**Solutions:**

Reset the admin password:

```bash
docker exec -it opentracker-grafana grafana-cli admin reset-admin-password <new-password>
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
   docker exec opentracker-db psql -U opentracker -c "SELECT * FROM pg_stat_activity WHERE state = 'active';"
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
cd /opt/opentracker
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
```

### Restart with Rebuild

```bash
cd /opt/opentracker
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
docker exec opentracker-db pg_dump -U opentracker opentracker > backup.sql
```

### Database Restore

```bash
cat backup.sql | docker exec -i opentracker-db psql -U opentracker opentracker
```

## Still Need Help?

If you're still experiencing issues:

1. Check the [GitHub Issues](https://github.com/florianjs/opentracker/issues) for similar problems
2. Open a new issue with:
   - Description of the problem
   - Relevant log output
   - Your environment (OS, Docker version)
   - Steps to reproduce
3. [Get professional support](/support/professional) if you need hands-on help
