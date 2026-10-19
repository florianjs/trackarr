//! Announce and scrape, end to end (port of `server/tracker/index.ts` filter
//! and `handlers.ts`).

use std::net::IpAddr;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use chrono::Utc;
use deadpool_postgres::Pool;

use crate::abuse::{self, FailureLimiter};
use crate::config::Config;
use crate::credit::{self, SeedingSets};
use crate::dedupe::Dedupe;
use crate::invalidate::Invalidation;
use crate::ledger::{self, Ledger, UserDelta};
use crate::lookups::{Lookups, TrackerTorrent, TrackerUser};
use crate::owners::Owners;
use crate::publish::{self, Completed, PublishState};
use crate::query::{AnnounceRequest, Event, Hash, ScrapeRequest, to_hex};
use crate::redis_store::RedisStore;
use crate::response::{self, ScrapeEntry};
use crate::rules::{self, Access};
use crate::settings::Settings;
use crate::snapshot;
use crate::swarms::{Applied, Outcome, PeerUpdate, Swarms};

const INTERNAL_ERROR: &str = "Internal tracker error";

pub fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis() as u64)
}

pub struct Tracker {
    pub config: Config,
    pub pool: Pool,
    pub swarms: Swarms,
    pub lookups: Lookups,
    pub ledger: Ledger,
    pub redis: RedisStore,
    pub completed: Completed,
    owners: Arc<Owners>,
    dedupe: Dedupe,
    pub limiter: FailureLimiter,
    seeding: SeedingSets,
    settings: RwLock<Arc<Settings>>,
    /// Successful announces since start
    pub announces: AtomicU64,
    started_at: u64,
    /// No publishing until swarms refilled; zero after restoring a fresh snapshot
    warmup_ms: AtomicU64,
    publish_state: tokio::sync::Mutex<PublishState>,
    /// A full resync has been published: dirty patches are now meaningful
    synced: AtomicBool,
}

impl Tracker {
    pub fn new(config: Config, pool: Pool, redis: RedisStore) -> Self {
        let owners = Arc::new(Owners::default());
        Tracker {
            lookups: Lookups::new(pool.clone(), owners.clone(), config.cache_capacity),
            owners,
            redis,
            completed: Completed::default(),
            announces: AtomicU64::new(0),
            started_at: now_ms(),
            warmup_ms: AtomicU64::new(config.warmup * 1000),
            publish_state: tokio::sync::Mutex::default(),
            synced: AtomicBool::new(false),
            swarms: Swarms::new(config.max_peers_per_user),
            limiter: FailureLimiter::new(config.max_failures_per_minute),
            config,
            pool,
            ledger: Ledger::default(),
            dedupe: Dedupe::default(),
            seeding: SeedingSets::default(),
            settings: RwLock::new(Arc::new(Settings::default())),
        }
    }

    pub fn settings(&self) -> Arc<Settings> {
        self.settings
            .read()
            .unwrap_or_else(|p| p.into_inner())
            .clone()
    }

    pub async fn reload_settings(&self) -> Result<(), String> {
        let settings = Settings::load(&self.pool).await?;
        *self.settings.write().unwrap_or_else(|p| p.into_inner()) = Arc::new(settings);
        Ok(())
    }

    /// Bencoded response body (success or failure reason)
    pub async fn announce(&self, request: &AnnounceRequest, ip: IpAddr) -> Vec<u8> {
        match self.try_announce(request, ip).await {
            Ok(body) => body,
            Err(reason) => response::failure(&reason),
        }
    }

    async fn try_announce(&self, request: &AnnounceRequest, ip: IpAddr) -> Result<Vec<u8>, String> {
        let Some(passkey) = request.passkey.as_deref() else {
            return Err("Passkey required".into());
        };
        let started = now_ms();
        let user = self.lookup_user(passkey, ip, started).await?;
        let torrent = self
            .lookups
            .torrent(&request.info_hash)
            .await
            .map_err(internal)?;
        if torrent.is_none() {
            self.limiter
                .counters
                .unknown_torrent
                .fetch_add(1, Ordering::Relaxed);
            self.limiter.record_failure(ip, started);
        }
        let settings = self.settings();
        let freeleech = settings.freeleech_active(Utc::now());

        // Credit not flushed yet still counts towards the ratio
        let user = user.map(|user| {
            let pending = self.ledger.pending_user(&user.id);
            TrackerUser {
                uploaded: user.uploaded + pending.uploaded,
                downloaded: user.downloaded + pending.downloaded,
                ..(*user).clone()
            }
        });

        match rules::check(
            user.as_ref(),
            torrent.as_deref(),
            settings.min_ratio,
            freeleech,
        ) {
            Access::Allowed => {}
            Access::Denied(reason) => return Err(reason),
            Access::NeedsSnatch(reason) => {
                let snatched = match (&user, &torrent) {
                    (Some(user), Some(torrent)) if request.is_seeder() => self
                        .lookups
                        .has_snatched(&user.id, &torrent.id)
                        .await
                        .map_err(internal)?,
                    _ => false,
                };
                if !snatched {
                    return Err(reason);
                }
            }
        }
        // Both exist once access is granted
        let (Some(user), Some(torrent)) = (user, torrent) else {
            return Err(INTERNAL_ERROR.into());
        };

        let now = now_ms();
        let outcome = self.swarms.announce(&PeerUpdate {
            info_hash: request.info_hash,
            peer_id: request.peer_id,
            owner: user.owner,
            ip,
            port: request.port,
            uploaded: request.uploaded,
            downloaded: request.downloaded,
            left: request.left,
            event: request.event,
            numwant: request.numwant,
            now,
        });

        if self.config.debug {
            tracing::debug!(
                info_hash = %to_hex(&request.info_hash),
                event = ?request.event,
                applied = ?outcome.applied,
                seeders = outcome.seeders,
                leechers = outcome.leechers,
                "announce"
            );
        }

        if outcome.applied == Applied::TooManyPeers {
            self.limiter
                .counters
                .too_many_peers
                .fetch_add(1, Ordering::Relaxed);
            return Err("Too many peers for this torrent".into());
        }

        if outcome.applied != Applied::NotOwner
            && self
                .dedupe
                .claim(&request.info_hash, &request.peer_id, request.event, now)
        {
            self.account(
                request, &user, &torrent, &settings, freeleech, &outcome, now,
            )
            .await;
        }

        self.announces.fetch_add(1, Ordering::Relaxed);
        Ok(response::announce(
            self.config.interval,
            outcome.seeders,
            outcome.leechers,
            &outcome.peers,
            request.compact,
        ))
    }

    #[allow(clippy::too_many_arguments)]
    async fn account(
        &self,
        request: &AnnounceRequest,
        user: &TrackerUser,
        torrent: &Arc<TrackerTorrent>,
        settings: &Settings,
        freeleech: bool,
        outcome: &Outcome,
        now: u64,
    ) {
        let credit = credit::compute_credit(
            outcome.previous.as_ref(),
            request.uploaded,
            request.downloaded,
            now,
            outcome.other_leechers,
            self.config.max_rate_bytes,
        );
        let seeding = request.is_seeder();
        let elapsed_seconds = outcome
            .previous
            .as_ref()
            .map_or(0, |p| now.saturating_sub(p.updated_at) / 1000);

        // Bonus points for seeding; never block the announce on it
        let bonus = if seeding && outcome.previous.is_some() {
            self.seeding_bonus(
                user,
                torrent,
                &request.info_hash,
                settings,
                elapsed_seconds,
                now,
            )
            .await
        } else {
            0.0
        };

        self.ledger.add_user(
            &user.id,
            UserDelta {
                uploaded: credit.uploaded as i64,
                // Global freeleech: downloaded data does not count against the ratio
                downloaded: if freeleech {
                    0
                } else {
                    credit.downloaded as i64
                },
                bonus,
            },
        );

        if request.event == Event::Stopped {
            return;
        }

        if request.event == Event::Completed {
            self.completed.add(&request.info_hash);
            if let Err(err) = ledger::create_hnr_entry(
                &self.pool,
                &user.id,
                &torrent.id,
                settings.hnr_enabled,
                settings.hnr_required_seed_time,
            )
            .await
            {
                tracing::error!("HnR entry failed: {err}");
            } else {
                self.lookups.mark_snatched(&user.id, &torrent.id).await;
            }
        }

        // Seed time for HnR (seeders only, max 1 hour per announce)
        if seeding && elapsed_seconds > 0 && elapsed_seconds < 3600 {
            self.ledger
                .add_seed_time(&user.id, &torrent.id, elapsed_seconds as i64);
        }
    }

    /// Points only for torrents the user really holds (`left=0` is client
    /// supplied), capped in number of torrents earning at once.
    async fn seeding_bonus(
        &self,
        user: &TrackerUser,
        torrent: &TrackerTorrent,
        info_hash: &crate::query::Hash,
        settings: &Settings,
        elapsed_seconds: u64,
        now: u64,
    ) -> f64 {
        if !settings.bonus_enabled || settings.bonus_points_per_seed_day <= 0.0 {
            return 0.0;
        }
        let points =
            credit::compute_seed_points(elapsed_seconds, settings.bonus_points_per_seed_day);
        if points <= 0.0 || !torrent.is_approved {
            return 0.0;
        }
        let is_uploader = torrent.uploader_id.as_ref() == Some(&user.id);
        if !is_uploader {
            match self.lookups.has_snatched(&user.id, &torrent.id).await {
                Ok(true) => {}
                Ok(false) => return 0.0,
                Err(err) => {
                    tracing::error!("seeding bonus lookup failed: {err}");
                    return 0.0;
                }
            }
        }
        if !self.seeding.admit(
            user.owner,
            info_hash,
            settings.bonus_max_seeding_torrents,
            now,
        ) {
            return 0.0;
        }
        points
    }

    /// Bencoded scrape response. Private tracker: a valid passkey and explicit
    /// hashes are required, and only approved torrents are reported.
    pub async fn scrape(&self, request: &ScrapeRequest, ip: IpAddr) -> Vec<u8> {
        match self.try_scrape(request, ip).await {
            Ok(body) => body,
            Err(reason) => response::failure(&reason),
        }
    }

    async fn try_scrape(&self, request: &ScrapeRequest, ip: IpAddr) -> Result<Vec<u8>, String> {
        let Some(passkey) = request.passkey.as_deref() else {
            return Err("Passkey required".into());
        };
        match self.lookup_user(passkey, ip, now_ms()).await? {
            Some(user) if !user.is_banned => {}
            _ => return Err("Invalid passkey".into()),
        }
        let allowed = self
            .lookups
            .scrapable(&request.info_hashes)
            .await
            .map_err(|err| internal(Arc::new(err)))?;
        let hashes: Vec<Hash> = request
            .info_hashes
            .iter()
            .filter(|hash| allowed.contains(&to_hex(hash)))
            .copied()
            .collect();
        let downloaded = self.completed.get_many(&self.redis, &hashes).await;
        let entries: Vec<ScrapeEntry> = hashes
            .iter()
            .zip(downloaded)
            .map(|(hash, downloaded)| {
                let (complete, incomplete) = self.swarms.counts(hash);
                ScrapeEntry {
                    info_hash: *hash,
                    complete,
                    incomplete,
                    downloaded,
                }
            })
            .collect();
        Ok(response::scrape(&entries))
    }

    /// The user behind a passkey, unless the client is over its failure
    /// budget: then nothing is looked up. Unknown passkeys count as failures.
    async fn lookup_user(
        &self,
        passkey: &str,
        ip: IpAddr,
        now: u64,
    ) -> Result<Option<Arc<TrackerUser>>, String> {
        if self.limiter.is_blocked(ip, now) {
            return Err("Too many invalid requests, try again later".into());
        }
        let user = if abuse::plausible_passkey(passkey) {
            self.lookups.user(passkey).await.map_err(internal)?
        } else {
            None
        };
        if user.is_none() {
            self.limiter
                .counters
                .invalid_passkey
                .fetch_add(1, Ordering::Relaxed);
            self.limiter.record_failure(ip, now);
        }
        Ok(user)
    }

    /// Periodic housekeeping: expired peers, bonus sets
    pub fn sweep(&self) {
        let now = now_ms();
        let expired = self.swarms.expire(now);
        self.seeding.purge(now);
        if !expired.is_empty() {
            tracing::debug!("expired {} peers", expired.len());
        }
    }

    pub async fn flush(&self) {
        match self.ledger.flush(&self.pool).await {
            Ok(0) => {}
            Ok(count) => tracing::debug!("flushed {count} accounting rows"),
            Err(err) => tracing::error!("accounting flush failed (will retry): {err}"),
        }
        if let Err(err) = self.completed.flush(&self.redis).await {
            tracing::warn!("completed counts not published (will retry): {err}");
        }
    }

    pub async fn apply(&self, invalidation: Invalidation) {
        tracing::debug!("invalidation: {invalidation:?}");
        match invalidation {
            Invalidation::Users => self.lookups.invalidate_users(),
            Invalidation::Torrents => self.lookups.invalidate_torrents(),
            Invalidation::Torrent(info_hash) => {
                self.lookups.invalidate_torrents();
                self.swarms.remove_swarm(&info_hash);
            }
            Invalidation::Settings => {
                if let Err(err) = self.reload_settings().await {
                    tracing::error!("settings reload failed: {err}");
                }
            }
        }
    }

    pub async fn invalidate_all(&self) {
        self.apply(Invalidation::Users).await;
        self.apply(Invalidation::Torrents).await;
        self.apply(Invalidation::Settings).await;
    }

    /// Save every peer (graceful shutdown). Returns the number saved.
    pub fn save_snapshot(&self, path: &std::path::Path) -> std::io::Result<usize> {
        let entries: Vec<snapshot::Entry> = self
            .swarms
            .snapshot()
            .into_iter()
            .filter_map(|(info_hash, peer_id, peer, seeder)| {
                let user_id = self.owners.user_id(peer.owner)?;
                Some(snapshot::Entry {
                    info_hash,
                    peer_id,
                    user_id: user_id.to_string(),
                    peer,
                    seeder,
                })
            })
            .collect();
        snapshot::save(path, &snapshot::encode(now_ms(), &entries))?;
        Ok(entries.len())
    }

    /// Load peers saved by the previous run, then delete the file so an old
    /// snapshot is never loaded twice. Returns the number restored.
    pub fn load_snapshot(&self, path: &std::path::Path) -> Result<usize, String> {
        let data = match std::fs::read(path) {
            Ok(data) => data,
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => return Ok(0),
            Err(err) => return Err(err.to_string()),
        };
        let _ = std::fs::remove_file(path);
        let saved = snapshot::decode(&data)?;
        let now = now_ms();
        let entries = snapshot::live(saved.entries, now);
        let count = entries.len();
        for entry in entries {
            let user_id: Arc<str> = Arc::from(entry.user_id);
            let peer = crate::swarms::Peer {
                owner: self.owners.intern(&user_id),
                ..entry.peer
            };
            self.swarms
                .restore(entry.info_hash, entry.peer_id, peer, entry.seeder);
        }
        // Saved moments ago: swarms are complete, publish right away
        if now.saturating_sub(saved.saved_at) < u64::from(self.config.interval) * 1000 {
            self.warmup_ms.store(0, Ordering::Relaxed);
        }
        Ok(count)
    }

    pub fn uptime_ms(&self) -> u64 {
        now_ms().saturating_sub(self.started_at)
    }

    pub fn is_synced(&self) -> bool {
        self.synced.load(Ordering::Relaxed)
    }

    /// Swarms whose counts changed, between two stats passes
    pub async fn publish_dirty(&self) {
        let dirty = self.swarms.take_dirty();
        // Before the first full resync, partial counts would overwrite good ones
        if dirty.is_empty() || !self.synced.load(Ordering::Relaxed) {
            return;
        }
        let (set, delete) = publish::swarm_entries(&dirty);
        if let Err(err) = self
            .redis
            .patch_hash(publish::SWARMS_KEY, &set, &delete)
            .await
        {
            tracing::warn!("swarm counts not published (will retry): {err}");
            self.swarms
                .mark_dirty(dirty.into_iter().map(|(hash, _)| hash));
        }
    }

    /// Site-wide stats and per-user activity; every few passes, rewrite the
    /// published hashes entirely.
    pub async fn publish_stats(&self) {
        let now = now_ms();
        let announces = self.announces.load(Ordering::Relaxed);
        let mut state = self.publish_state.lock().await;
        let since_last = announces - state.last_announces;
        state.last_announces = announces;
        let warmup_ms = self.warmup_ms.load(Ordering::Relaxed);
        if !publish::may_publish(now, self.started_at, warmup_ms, since_last) {
            return;
        }

        // Walks every peer: keep it off the async workers
        let stats = tokio::task::block_in_place(|| self.swarms.stats());
        if let Err(err) = self
            .redis
            .set_stats(&publish::stats_fields(&stats, now))
            .await
        {
            tracing::warn!("tracker stats not published: {err}");
            return;
        }

        let user_entry = |owner, counts| {
            self.owners
                .user_id(owner)
                .map(|id| (id.to_string(), publish::counts_value(counts)))
        };
        let resync = state.passes % publish::RESYNC_EVERY == 0;
        let result = if resync {
            let users: Vec<_> = stats
                .users
                .iter()
                .filter_map(|(owner, counts)| user_entry(*owner, *counts))
                .collect();
            // Changes after this snapshot are flagged again and patched later
            self.swarms.take_dirty();
            let (swarms, _) = publish::swarm_entries(&self.swarms.all_counts());
            match self.redis.replace_hash(publish::USERS_KEY, &users).await {
                Ok(()) => self.redis.replace_hash(publish::SWARMS_KEY, &swarms).await,
                Err(err) => Err(err),
            }
        } else {
            let (changed, removed) = publish::diff_users(&state.users, &stats.users);
            let set: Vec<_> = changed
                .into_iter()
                .filter_map(|(owner, counts)| user_entry(owner, counts))
                .collect();
            let delete: Vec<_> = removed
                .into_iter()
                .filter_map(|owner| self.owners.user_id(owner).map(|id| id.to_string()))
                .collect();
            self.redis
                .patch_hash(publish::USERS_KEY, &set, &delete)
                .await
        };

        match result {
            Ok(()) => {
                if resync {
                    self.synced.store(true, Ordering::Relaxed);
                    tracing::info!(
                        "published full resync: {} swarms, {} users",
                        stats.torrents,
                        stats.users.len()
                    );
                }
                state.users = stats.users;
                state.passes += 1;
            }
            Err(err) => tracing::warn!("user activity not published (will retry): {err}"),
        }
    }
}

fn internal(err: Arc<String>) -> String {
    tracing::error!("lookup failed: {err}");
    INTERNAL_ERROR.into()
}

/// Background loops: flush and publish, sweep, stats, settings refresh
pub fn spawn_jobs(tracker: Arc<Tracker>) {
    let flush_every = Duration::from_secs(tracker.config.flush_interval);
    let t = tracker.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(flush_every);
        loop {
            tick.tick().await;
            // Entries live 2 s: purged often, or a busy tracker holds millions
            t.dedupe.purge(now_ms());
            t.limiter.purge(now_ms());
            t.flush().await;
            t.publish_dirty().await;
        }
    });

    let stats_every = Duration::from_secs(tracker.config.stats_interval);
    let t = tracker.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(stats_every);
        loop {
            tick.tick().await;
            t.publish_stats().await;
        }
    });

    let t = tracker.clone();
    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(60));
        loop {
            tick.tick().await;
            t.sweep();
        }
    });

    tokio::spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(30));
        loop {
            tick.tick().await;
            if let Err(err) = tracker.reload_settings().await {
                tracing::error!("settings reload failed: {err}");
            }
        }
    });
}
