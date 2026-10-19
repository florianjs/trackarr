//! Cached lookups for the announce hot path (port of `server/tracker/lookups.ts`).
//!
//! Users by passkey, torrents by info hash and snatches change rarely: they
//! are kept for 30 s, misses included (absorbs floods of bad passkeys).
//! Writes that matter clear the caches through `tracker:invalidate`.

use std::sync::Arc;
use std::time::Duration;

use deadpool_postgres::Pool;
use moka::future::Cache;

use crate::owners::Owners;
use crate::query::{Hash, to_hex};
use crate::swarms::Owner;

const TTL: Duration = Duration::from_secs(30);

#[derive(Debug, Clone)]
pub struct TrackerUser {
    pub id: Arc<str>,
    pub owner: Owner,
    pub is_banned: bool,
    pub is_staff: bool,
    pub uploaded: i64,
    pub downloaded: i64,
}

#[derive(Debug, Clone)]
pub struct TrackerTorrent {
    pub id: Arc<str>,
    pub is_active: bool,
    pub is_approved: bool,
    pub uploader_id: Option<Arc<str>>,
}

pub type LookupError = Arc<String>;

pub struct Lookups {
    pool: Pool,
    owners: Arc<Owners>,
    users: Cache<String, Option<Arc<TrackerUser>>>,
    torrents: Cache<Hash, Option<Arc<TrackerTorrent>>>,
    snatches: Cache<(Arc<str>, Arc<str>), bool>,
}

fn cache<K, V>(capacity: u64) -> Cache<K, V>
where
    K: std::hash::Hash + Eq + Send + Sync + 'static,
    V: Clone + Send + Sync + 'static,
{
    Cache::builder()
        .max_capacity(capacity)
        .time_to_live(TTL)
        .build()
}

fn db_error(err: impl std::fmt::Display) -> String {
    err.to_string()
}

impl Lookups {
    pub fn new(pool: Pool, owners: Arc<Owners>, capacity: u64) -> Self {
        Lookups {
            pool,
            owners,
            users: cache(capacity),
            torrents: cache(capacity),
            snatches: cache(capacity * 2),
        }
    }

    pub async fn user(&self, passkey: &str) -> Result<Option<Arc<TrackerUser>>, LookupError> {
        self.users
            .try_get_with(passkey.to_owned(), self.load_user(passkey))
            .await
    }

    async fn load_user(&self, passkey: &str) -> Result<Option<Arc<TrackerUser>>, String> {
        let client = self.pool.get().await.map_err(db_error)?;
        let statement = client
            .prepare_cached(
                "SELECT id, is_banned, is_admin, is_moderator, uploaded, downloaded \
                 FROM users WHERE passkey = $1 LIMIT 1",
            )
            .await
            .map_err(db_error)?;
        let row = client
            .query_opt(&statement, &[&passkey])
            .await
            .map_err(db_error)?;
        Ok(row.map(|row| {
            let id: Arc<str> = Arc::from(row.get::<_, String>(0));
            Arc::new(TrackerUser {
                owner: self.owners.intern(&id),
                id,
                is_banned: row.get(1),
                is_staff: row.get::<_, bool>(2) || row.get::<_, bool>(3),
                uploaded: row.get(4),
                downloaded: row.get(5),
            })
        }))
    }

    pub async fn torrent(
        &self,
        info_hash: &Hash,
    ) -> Result<Option<Arc<TrackerTorrent>>, LookupError> {
        self.torrents
            .try_get_with(*info_hash, self.load_torrent(info_hash))
            .await
    }

    async fn load_torrent(&self, info_hash: &Hash) -> Result<Option<Arc<TrackerTorrent>>, String> {
        let client = self.pool.get().await.map_err(db_error)?;
        let statement = client
            .prepare_cached(
                "SELECT id, is_active, is_approved, uploader_id \
                 FROM torrents WHERE info_hash = $1 LIMIT 1",
            )
            .await
            .map_err(db_error)?;
        let row = client
            .query_opt(&statement, &[&to_hex(info_hash)])
            .await
            .map_err(db_error)?;
        Ok(row.map(|row| {
            Arc::new(TrackerTorrent {
                id: Arc::from(row.get::<_, String>(0)),
                is_active: row.get(1),
                is_approved: row.get(2),
                uploader_id: row.get::<_, Option<String>>(3).map(Arc::from),
            })
        }))
    }

    /// Whether the user really completed the torrent (an HnR entry exists)
    pub async fn has_snatched(
        &self,
        user_id: &Arc<str>,
        torrent_id: &Arc<str>,
    ) -> Result<bool, LookupError> {
        let key = (user_id.clone(), torrent_id.clone());
        self.snatches
            .try_get_with(key, self.load_snatch(user_id, torrent_id))
            .await
    }

    async fn load_snatch(&self, user_id: &str, torrent_id: &str) -> Result<bool, String> {
        let client = self.pool.get().await.map_err(db_error)?;
        let statement = client
            .prepare_cached(
                "SELECT 1 FROM hnr_tracking WHERE user_id = $1 AND torrent_id = $2 LIMIT 1",
            )
            .await
            .map_err(db_error)?;
        let row = client
            .query_opt(&statement, &[&user_id, &torrent_id])
            .await
            .map_err(db_error)?;
        Ok(row.is_some())
    }

    pub async fn mark_snatched(&self, user_id: &Arc<str>, torrent_id: &Arc<str>) {
        self.snatches
            .insert((user_id.clone(), torrent_id.clone()), true)
            .await;
    }

    /// Info hashes (hex) among `hashes` that are active and approved
    pub async fn scrapable(&self, hashes: &[Hash]) -> Result<Vec<String>, String> {
        let hex: Vec<String> = hashes.iter().map(to_hex).collect();
        let client = self.pool.get().await.map_err(db_error)?;
        let statement = client
            .prepare_cached(
                "SELECT info_hash FROM torrents \
                 WHERE info_hash = ANY($1) AND is_active AND is_approved",
            )
            .await
            .map_err(db_error)?;
        let rows = client.query(&statement, &[&hex]).await.map_err(db_error)?;
        Ok(rows.iter().map(|row| row.get(0)).collect())
    }

    pub fn invalidate_users(&self) {
        self.users.invalidate_all();
    }

    pub fn invalidate_torrents(&self) {
        self.torrents.invalidate_all();
    }
}
