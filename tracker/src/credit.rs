//! Upload/download credit and seeding bonus (port of `server/tracker/credit.ts`,
//! `bonusAccrual.ts` and `computeSeedPoints`).
//!
//! Clients report cumulative counters themselves, so deltas are untrusted: a
//! modified client can claim terabytes in one announce. Credit is bounded by
//! elapsed time and by whether anyone in the swarm could have received it.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::query::Hash;
use crate::swarms::{Owner, Previous};

/// Default ceiling: 100 MiB/s sustained, far above residential links.
pub const DEFAULT_MAX_RATE_BYTES: u64 = 100 * 1024 * 1024;
/// Announces further apart than this do not earn more (client went away)
pub const MAX_ACCRUAL_SECONDS: u64 = 3600;
/// How long a torrent stays "currently seeding" for the bonus cap
const SEEDING_WINDOW_MS: u64 = 2 * 3600 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub struct Credit {
    pub uploaded: u64,
    pub downloaded: u64,
}

pub fn compute_credit(
    previous: Option<&Previous>,
    uploaded: u64,
    downloaded: u64,
    now: u64,
    other_leechers: u32,
    max_rate_bytes: u64,
) -> Credit {
    // First announce of a session: no baseline, nothing to credit
    let Some(previous) = previous else {
        return Credit::default();
    };
    let elapsed_sec = (now.saturating_sub(previous.updated_at) as f64 / 1000.0).max(1.0);
    let ceiling = (elapsed_sec * max_rate_bytes as f64).floor() as u64;

    let mut delta_uploaded = uploaded.saturating_sub(previous.uploaded);
    let delta_downloaded = downloaded.saturating_sub(previous.downloaded);

    // Nobody to upload to: any claimed upload is fake
    if other_leechers == 0 {
        delta_uploaded = 0;
    }

    Credit {
        uploaded: delta_uploaded.min(ceiling),
        downloaded: delta_downloaded.min(ceiling),
    }
}

pub fn compute_seed_points(elapsed_seconds: u64, points_per_day: f64) -> f64 {
    if elapsed_seconds == 0 || !points_per_day.is_finite() || points_per_day <= 0.0 {
        return 0.0;
    }
    points_per_day * elapsed_seconds.min(MAX_ACCRUAL_SECONDS) as f64 / 86400.0
}

/// Torrents each user recently earned seeding points on, to cap how many
/// earn at once (was a Redis sorted set per user).
#[derive(Default)]
pub struct SeedingSets {
    users: Mutex<HashMap<Owner, HashMap<Hash, u64>>>,
}

impl SeedingSets {
    /// Record the torrent and say whether it may earn: already earning, or under the cap.
    pub fn admit(&self, owner: Owner, info_hash: &Hash, max: usize, now: u64) -> bool {
        let mut users = self.users.lock().unwrap_or_else(|p| p.into_inner());
        let set = users.entry(owner).or_default();
        set.retain(|_, seen| now.saturating_sub(*seen) < SEEDING_WINDOW_MS);
        if !set.contains_key(info_hash) && set.len() >= max {
            return false;
        }
        set.insert(*info_hash, now);
        true
    }

    pub fn purge(&self, now: u64) {
        let mut users = self.users.lock().unwrap_or_else(|p| p.into_inner());
        users.retain(|_, set| {
            set.retain(|_, seen| now.saturating_sub(*seen) < SEEDING_WINDOW_MS);
            !set.is_empty()
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const MIB: u64 = 1024 * 1024;

    fn previous(uploaded: u64, downloaded: u64, updated_at: u64) -> Previous {
        Previous {
            uploaded,
            downloaded,
            updated_at,
            seeder: false,
        }
    }

    #[test]
    fn first_announce_credits_nothing() {
        let credit = compute_credit(None, 10 * MIB, 10 * MIB, 0, 5, DEFAULT_MAX_RATE_BYTES);
        assert_eq!(credit, Credit::default());
    }

    #[test]
    fn credits_deltas() {
        let p = previous(MIB, 2 * MIB, 0);
        let credit = compute_credit(
            Some(&p),
            3 * MIB,
            5 * MIB,
            60_000,
            1,
            DEFAULT_MAX_RATE_BYTES,
        );
        assert_eq!(
            credit,
            Credit {
                uploaded: 2 * MIB,
                downloaded: 3 * MIB
            }
        );
    }

    #[test]
    fn caps_by_elapsed_time() {
        let p = previous(0, 0, 0);
        // 10 s at 1 MiB/s max
        let credit = compute_credit(Some(&p), 1000 * MIB, 1000 * MIB, 10_000, 1, MIB);
        assert_eq!(
            credit,
            Credit {
                uploaded: 10 * MIB,
                downloaded: 10 * MIB
            }
        );
        // Under a second still allows one second's worth
        let credit = compute_credit(Some(&p), 1000 * MIB, 0, 200, 1, MIB);
        assert_eq!(credit.uploaded, MIB);
    }

    #[test]
    fn no_upload_without_leechers() {
        let p = previous(0, 0, 0);
        let credit = compute_credit(Some(&p), MIB, MIB, 60_000, 0, DEFAULT_MAX_RATE_BYTES);
        assert_eq!(
            credit,
            Credit {
                uploaded: 0,
                downloaded: MIB
            }
        );
    }

    #[test]
    fn counter_reset_credits_nothing() {
        let p = previous(5 * MIB, 5 * MIB, 0);
        let credit = compute_credit(Some(&p), MIB, MIB, 60_000, 1, DEFAULT_MAX_RATE_BYTES);
        assert_eq!(credit, Credit::default());
    }

    #[test]
    fn seed_points() {
        assert_eq!(compute_seed_points(0, 10.0), 0.0);
        assert_eq!(compute_seed_points(2160, 40.0), 1.0);
        assert_eq!(
            compute_seed_points(100_000, 24.0),
            1.0,
            "capped at one hour"
        );
        assert_eq!(compute_seed_points(3600, 0.0), 0.0);
        assert_eq!(compute_seed_points(3600, f64::NAN), 0.0);
    }

    #[test]
    fn seeding_cap() {
        let sets = SeedingSets::default();
        assert!(sets.admit(1, &[1; 20], 2, 0));
        assert!(sets.admit(1, &[2; 20], 2, 0));
        assert!(!sets.admit(1, &[3; 20], 2, 0), "over the cap");
        assert!(sets.admit(1, &[1; 20], 2, 10), "already earning");
        assert!(sets.admit(2, &[3; 20], 2, 0), "per user");
        // Torrent 2 leaves the window, torrent 1 was refreshed at 10
        assert!(sets.admit(1, &[3; 20], 2, SEEDING_WINDOW_MS + 5));
        sets.purge(SEEDING_WINDOW_MS * 3);
        assert!(sets.users.lock().unwrap().is_empty());
    }
}
