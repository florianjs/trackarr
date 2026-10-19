//! What the web app reads from Redis instead of scanning peer hashes:
//!
//! - `tracker:swarms`        info hash → "seeders:leechers"
//! - `tracker:user_activity` user id   → "seeding:leeching"
//! - `tracker:stats`         site-wide counters
//! - `stats:<hash>`          `completed`, same key as before
//!
//! After a restart, swarms refill as clients re-announce (one interval).
//! Nothing is published during that warm-up, so the web app keeps the last
//! good numbers; then a full resync replaces both hashes atomically
//! (written under a temporary key, then RENAME). A node serving no announces
//! (passive node of an active/passive pair) publishes nothing either.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;

use moka::future::Cache;
use redis::Pipeline;

use crate::query::{Hash, to_hex};
use crate::redis_store::RedisStore;
use crate::swarms::{Owner, SwarmStats};

pub const SWARMS_KEY: &str = "tracker:swarms";
pub const USERS_KEY: &str = "tracker:user_activity";
const STATS_KEY: &str = "tracker:stats";
/// Fields per HSET when rewriting a whole hash
const BATCH: usize = 1000;
/// Stats passes between two full resyncs
pub const RESYNC_EVERY: u32 = 10;

pub fn counts_value((a, b): (u32, u32)) -> String {
    format!("{a}:{b}")
}

/// (seeding, leeching) torrents per user
pub type Activity = HashMap<Owner, (u32, u32)>;

/// Users whose (seeding, leeching) changed, and users no longer active
pub fn diff_users(previous: &Activity, next: &Activity) -> (Activity, Vec<Owner>) {
    let changed = next
        .iter()
        .filter(|(owner, counts)| previous.get(owner) != Some(counts))
        .map(|(owner, counts)| (*owner, *counts))
        .collect();
    let removed = previous
        .keys()
        .filter(|owner| !next.contains_key(owner))
        .copied()
        .collect();
    (changed, removed)
}

/// Publishing is allowed once swarms had a full interval to refill, and only
/// on a node that is actually serving announces.
pub fn may_publish(now: u64, started_at: u64, warmup_ms: u64, announces_since_last: u64) -> bool {
    now.saturating_sub(started_at) >= warmup_ms && announces_since_last > 0
}

#[derive(Default)]
pub struct PublishState {
    pub users: Activity,
    pub passes: u32,
    pub last_announces: u64,
}

pub fn stats_fields(stats: &SwarmStats, now: u64) -> Vec<(&'static str, String)> {
    vec![
        ("torrents", stats.torrents.to_string()),
        ("peers", (stats.seeders + stats.leechers).to_string()),
        ("seeders", stats.seeders.to_string()),
        ("leechers", stats.leechers.to_string()),
        ("seededTorrents", stats.seeded_torrents.to_string()),
        ("uniquePeers", stats.unique_peers.to_string()),
        ("uniqueSeeders", stats.unique_seeders.to_string()),
        ("updatedAt", now.to_string()),
    ]
}

impl RedisStore {
    /// Replace a whole hash atomically: fill a temporary key, then RENAME.
    pub async fn replace_hash(
        &self,
        key: &str,
        entries: &[(String, String)],
    ) -> Result<(), String> {
        let target = self.key(key);
        if entries.is_empty() {
            return self.query(redis::pipe().del(&target).ignore()).await;
        }
        let temp = self.key(&format!("{key}:next"));
        self.query::<()>(redis::pipe().del(&temp).ignore()).await?;
        for chunk in entries.chunks(BATCH) {
            self.query::<()>(redis::pipe().hset_multiple(&temp, chunk).ignore())
                .await?;
        }
        self.query(redis::pipe().rename(&temp, &target).ignore())
            .await
    }

    /// HSET changed fields and HDEL removed ones in one round trip
    pub async fn patch_hash(
        &self,
        key: &str,
        set: &[(String, String)],
        delete: &[String],
    ) -> Result<(), String> {
        if set.is_empty() && delete.is_empty() {
            return Ok(());
        }
        let target = self.key(key);
        let mut pipe = redis::pipe();
        for chunk in set.chunks(BATCH) {
            pipe.hset_multiple(&target, chunk).ignore();
        }
        for chunk in delete.chunks(BATCH) {
            pipe.hdel(&target, chunk).ignore();
        }
        self.query(&pipe).await
    }

    pub async fn set_stats(&self, fields: &[(&str, String)]) -> Result<(), String> {
        self.query(
            redis::pipe()
                .hset_multiple(self.key(STATS_KEY), fields)
                .ignore(),
        )
        .await
    }
}

pub fn swarm_entries(counts: &[(Hash, (u32, u32))]) -> (Vec<(String, String)>, Vec<String>) {
    let mut set = Vec::new();
    let mut delete = Vec::new();
    for (hash, counts) in counts {
        if *counts == (0, 0) {
            delete.push(to_hex(hash));
        } else {
            set.push((to_hex(hash), counts_value(*counts)));
        }
    }
    (set, delete)
}

/// Completed downloads: increments are batched to `stats:<hash>` and read
/// back (cached a minute) for the scrape `downloaded` field.
pub struct Completed {
    pending: Mutex<HashMap<Hash, u32>>,
    cache: Cache<Hash, u32>,
}

impl Default for Completed {
    fn default() -> Self {
        Completed {
            pending: Mutex::default(),
            cache: Cache::builder()
                .max_capacity(200_000)
                .time_to_live(Duration::from_secs(60))
                .build(),
        }
    }
}

fn completed_key(redis: &RedisStore, hash: &Hash) -> String {
    redis.key(&format!("stats:{}", to_hex(hash)))
}

impl Completed {
    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<Hash, u32>> {
        self.pending.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn add(&self, hash: &Hash) {
        *self.lock().entry(*hash).or_default() += 1;
    }

    pub async fn flush(&self, redis: &RedisStore) -> Result<(), String> {
        let pending = std::mem::take(&mut *self.lock());
        if pending.is_empty() {
            return Ok(());
        }
        let mut pipe = redis::pipe();
        for (hash, n) in &pending {
            pipe.hincr(completed_key(redis, hash), "completed", *n)
                .ignore();
        }
        match redis.query::<()>(&pipe).await {
            Ok(()) => {
                for hash in pending.keys() {
                    self.cache.invalidate(hash).await;
                }
                Ok(())
            }
            Err(err) => {
                let mut current = self.lock();
                for (hash, n) in pending {
                    *current.entry(hash).or_default() += n;
                }
                Err(err)
            }
        }
    }

    /// Completed count per hash; 0 when Redis cannot be read
    pub async fn get_many(&self, redis: &RedisStore, hashes: &[Hash]) -> Vec<u32> {
        let mut values = Vec::with_capacity(hashes.len());
        let mut missing = Vec::new();
        for (i, hash) in hashes.iter().enumerate() {
            match self.cache.get(hash).await {
                Some(n) => values.push(n),
                None => {
                    values.push(0);
                    missing.push(i);
                }
            }
        }
        if !missing.is_empty() {
            let mut pipe: Pipeline = redis::pipe();
            for &i in &missing {
                pipe.hget(completed_key(redis, &hashes[i]), "completed");
            }
            match redis.query::<Vec<Option<u32>>>(&pipe).await {
                Ok(loaded) => {
                    for (&i, n) in missing.iter().zip(loaded) {
                        let n = n.unwrap_or(0);
                        self.cache.insert(hashes[i], n).await;
                        values[i] = n;
                    }
                }
                Err(err) => tracing::warn!("completed counts unavailable: {err}"),
            }
        }
        let pending = self.lock();
        for (value, hash) in values.iter_mut().zip(hashes) {
            *value += pending.get(hash).copied().unwrap_or(0);
        }
        values
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn diffs_user_activity() {
        let previous = HashMap::from([(1, (1, 0)), (2, (0, 2)), (3, (1, 1))]);
        let next = HashMap::from([(1, (1, 0)), (2, (1, 2)), (4, (0, 1))]);
        let (changed, removed) = diff_users(&previous, &next);
        assert_eq!(changed, HashMap::from([(2, (1, 2)), (4, (0, 1))]));
        assert_eq!(removed, vec![3]);
    }

    #[test]
    fn publishing_gate() {
        assert!(!may_publish(5_000, 0, 600_000, 10), "warming up");
        assert!(!may_publish(700_000, 0, 600_000, 0), "idle node");
        assert!(may_publish(700_000, 0, 600_000, 1));
    }

    #[test]
    fn swarm_entries_split_empty_swarms() {
        let (set, delete) = swarm_entries(&[([0xab; 20], (3, 4)), ([0x01; 20], (0, 0))]);
        assert_eq!(set, vec![("ab".repeat(20), "3:4".to_owned())]);
        assert_eq!(delete, vec!["01".repeat(20)]);
    }

    #[test]
    fn stats_field_names() {
        let stats = SwarmStats {
            torrents: 2,
            seeders: 3,
            leechers: 4,
            seeded_torrents: 1,
            unique_peers: 5,
            unique_seeders: 2,
            users: HashMap::new(),
        };
        let fields = stats_fields(&stats, 42);
        assert!(fields.contains(&("peers", "7".to_owned())));
        assert!(fields.contains(&("uniquePeers", "5".to_owned())));
        assert!(fields.contains(&("updatedAt", "42".to_owned())));
    }
}
