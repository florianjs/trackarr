//! Batched accounting writes.
//!
//! Announces add their credit, bonus points and seed time here; a flush every
//! few seconds writes them in two statements instead of one `UPDATE users`
//! per announce. A failed flush keeps the deltas for the next one.

use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use deadpool_postgres::Pool;

#[derive(Debug, Clone, Copy, Default, PartialEq)]
pub struct UserDelta {
    pub uploaded: i64,
    pub downloaded: i64,
    pub bonus: f64,
}

impl UserDelta {
    fn merge(&mut self, other: UserDelta) {
        self.uploaded += other.uploaded;
        self.downloaded += other.downloaded;
        self.bonus += other.bonus;
    }
}

#[derive(Default)]
pub struct Pending {
    pub users: HashMap<Arc<str>, UserDelta>,
    /// (user id, torrent id) → seconds seeded
    pub seed_time: HashMap<(Arc<str>, Arc<str>), i64>,
}

impl Pending {
    fn is_empty(&self) -> bool {
        self.users.is_empty() && self.seed_time.is_empty()
    }

    fn merge(&mut self, other: Pending) {
        for (user, delta) in other.users {
            self.users.entry(user).or_default().merge(delta);
        }
        for (key, seconds) in other.seed_time {
            *self.seed_time.entry(key).or_default() += seconds;
        }
    }
}

#[derive(Default)]
pub struct Ledger {
    pending: Mutex<Pending>,
}

impl Ledger {
    fn lock(&self) -> std::sync::MutexGuard<'_, Pending> {
        self.pending.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn add_user(&self, user_id: &Arc<str>, delta: UserDelta) {
        if delta == UserDelta::default() {
            return;
        }
        self.lock()
            .users
            .entry(user_id.clone())
            .or_default()
            .merge(delta);
    }

    pub fn add_seed_time(&self, user_id: &Arc<str>, torrent_id: &Arc<str>, seconds: i64) {
        *self
            .lock()
            .seed_time
            .entry((user_id.clone(), torrent_id.clone()))
            .or_default() += seconds;
    }

    /// Rows waiting for the next flush
    pub fn pending_len(&self) -> usize {
        let pending = self.lock();
        pending.users.len() + pending.seed_time.len()
    }

    /// Credit not written yet, so ratio checks are not behind
    pub fn pending_user(&self, user_id: &Arc<str>) -> UserDelta {
        self.lock().users.get(user_id).copied().unwrap_or_default()
    }

    pub fn take(&self) -> Pending {
        std::mem::take(&mut *self.lock())
    }

    /// Put back deltas a failed flush could not write
    pub fn restore(&self, pending: Pending) {
        self.lock().merge(pending);
    }

    pub async fn flush(&self, pool: &Pool) -> Result<usize, String> {
        let pending = self.take();
        if pending.is_empty() {
            return Ok(0);
        }
        let count = pending.users.len() + pending.seed_time.len();
        match write(pool, &pending).await {
            Ok(()) => Ok(count),
            Err(err) => {
                self.restore(pending);
                Err(err)
            }
        }
    }
}

async fn write(pool: &Pool, pending: &Pending) -> Result<(), String> {
    let mut client = pool.get().await.map_err(|e| e.to_string())?;
    // Both or neither: a retry must not apply the users half twice
    let tx = client.transaction().await.map_err(|e| e.to_string())?;

    if !pending.users.is_empty() {
        let mut ids = Vec::with_capacity(pending.users.len());
        let mut uploaded = Vec::with_capacity(pending.users.len());
        let mut downloaded = Vec::with_capacity(pending.users.len());
        let mut bonus = Vec::with_capacity(pending.users.len());
        for (id, delta) in &pending.users {
            ids.push(id.as_ref());
            uploaded.push(delta.uploaded);
            downloaded.push(delta.downloaded);
            bonus.push(delta.bonus);
        }
        let statement = tx
            .prepare_cached(
                "UPDATE users AS u SET \
                   uploaded = u.uploaded + v.up, \
                   downloaded = u.downloaded + v.down, \
                   bonus_points = u.bonus_points + v.bonus \
                 FROM unnest($1::text[], $2::int8[], $3::int8[], $4::float8[]) AS v(id, up, down, bonus) \
                 WHERE u.id = v.id",
            )
            .await
            .map_err(|e| e.to_string())?;
        tx.execute(&statement, &[&ids, &uploaded, &downloaded, &bonus])
            .await
            .map_err(|e| e.to_string())?;
    }

    if !pending.seed_time.is_empty() {
        let mut user_ids = Vec::with_capacity(pending.seed_time.len());
        let mut torrent_ids = Vec::with_capacity(pending.seed_time.len());
        let mut seconds = Vec::with_capacity(pending.seed_time.len());
        for ((user, torrent), secs) in &pending.seed_time {
            user_ids.push(user.as_ref());
            torrent_ids.push(torrent.as_ref());
            seconds.push(i32::try_from(*secs).unwrap_or(i32::MAX));
        }
        // Same rule as `updateSeedTime`: mark the requirement met once reached;
        // exempt or completed entries are left untouched
        let statement = tx
            .prepare_cached(
                "UPDATE hnr_tracking AS h SET \
                   seed_time = h.seed_time + v.secs, \
                   is_hnr = CASE WHEN h.seed_time + v.secs >= h.required_seed_time THEN false ELSE h.is_hnr END, \
                   completed_at = CASE WHEN h.seed_time + v.secs >= h.required_seed_time THEN now() ELSE h.completed_at END \
                 FROM unnest($1::text[], $2::text[], $3::int4[]) AS v(user_id, torrent_id, secs) \
                 WHERE h.user_id = v.user_id AND h.torrent_id = v.torrent_id \
                   AND h.is_exempt = false AND h.completed_at IS NULL",
            )
            .await
            .map_err(|e| e.to_string())?;
        tx.execute(&statement, &[&user_ids, &torrent_ids, &seconds])
            .await
            .map_err(|e| e.to_string())?;
    }

    tx.commit().await.map_err(|e| e.to_string())
}

/// Record a snatch: also the proof the user holds the torrent (bonus points),
/// so it is created even when HnR is disabled, as exempt (`createHnrEntry`).
pub async fn create_hnr_entry(
    pool: &Pool,
    user_id: &str,
    torrent_id: &str,
    hnr_enabled: bool,
    required_seed_time: i32,
) -> Result<(), String> {
    let client = pool.get().await.map_err(|e| e.to_string())?;
    let statement = client
        .prepare_cached(
            "INSERT INTO hnr_tracking \
               (id, user_id, torrent_id, downloaded_at, seed_time, required_seed_time, is_hnr, is_exempt) \
             VALUES (gen_random_uuid()::text, $1, $2, now(), 0, $3, false, $4) \
             ON CONFLICT (user_id, torrent_id) DO NOTHING",
        )
        .await
        .map_err(|e| e.to_string())?;
    client
        .execute(
            &statement,
            &[&user_id, &torrent_id, &required_seed_time, &!hnr_enabled],
        )
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn merges_deltas_and_restores() {
        let ledger = Ledger::default();
        let user: Arc<str> = Arc::from("u1");
        let torrent: Arc<str> = Arc::from("t1");
        ledger.add_user(
            &user,
            UserDelta {
                uploaded: 10,
                downloaded: 5,
                bonus: 0.5,
            },
        );
        ledger.add_user(
            &user,
            UserDelta {
                uploaded: 1,
                downloaded: 0,
                bonus: 0.25,
            },
        );
        ledger.add_user(&user, UserDelta::default());
        ledger.add_seed_time(&user, &torrent, 30);
        ledger.add_seed_time(&user, &torrent, 30);
        assert_eq!(
            ledger.pending_user(&user),
            UserDelta {
                uploaded: 11,
                downloaded: 5,
                bonus: 0.75
            }
        );

        let taken = ledger.take();
        assert_eq!(ledger.pending_user(&user), UserDelta::default());
        assert_eq!(taken.seed_time[&(user.clone(), torrent.clone())], 60);

        // A failed flush puts them back, merged with newer deltas
        ledger.add_user(
            &user,
            UserDelta {
                uploaded: 1,
                downloaded: 1,
                bonus: 0.0,
            },
        );
        ledger.restore(taken);
        assert_eq!(
            ledger.pending_user(&user),
            UserDelta {
                uploaded: 12,
                downloaded: 6,
                bonus: 0.75
            }
        );
    }
}
