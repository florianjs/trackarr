//! Cheap rejection of hostile traffic before it reaches the database.
//!
//! Unknown passkeys and info hashes are cached as misses, but random ones
//! never hit the cache: each would cost a query. Clients failing too often
//! (invalid passkey, unknown torrent) are refused for the rest of the window
//! without any lookup. IPv6 clients are grouped by /64, the block a single
//! subscriber usually controls.

use std::collections::HashMap;
use std::net::IpAddr;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU64, Ordering};

pub const WINDOW_MS: u64 = 60_000;
pub const DEFAULT_MAX_FAILURES: u32 = 120;

/// Passkeys are hex tokens (32 or 40 chars): anything far off is not worth a query
pub fn plausible_passkey(passkey: &str) -> bool {
    (16..=128).contains(&passkey.len())
        && passkey
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn client_key(ip: IpAddr) -> u128 {
    match ip {
        IpAddr::V4(v4) => u128::from(u32::from(v4)),
        // Keep the /64 prefix, tagged so it never collides with an IPv4
        IpAddr::V6(v6) => (u128::from(v6) & !u128::from(u64::MAX)) | 1,
    }
}

#[derive(Default)]
pub struct Counters {
    pub invalid_passkey: AtomicU64,
    pub unknown_torrent: AtomicU64,
    pub too_many_peers: AtomicU64,
    pub blocked: AtomicU64,
}

pub struct FailureLimiter {
    max_failures: u32,
    /// client → (failures, window start)
    clients: Mutex<HashMap<u128, (u32, u64)>>,
    pub counters: Counters,
}

impl FailureLimiter {
    pub fn new(max_failures: u32) -> Self {
        FailureLimiter {
            max_failures: max_failures.max(1),
            clients: Mutex::default(),
            counters: Counters::default(),
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<u128, (u32, u64)>> {
        self.clients.lock().unwrap_or_else(|p| p.into_inner())
    }

    /// True while the client is over its failure budget for this window
    pub fn is_blocked(&self, ip: IpAddr, now: u64) -> bool {
        let blocked = self
            .lock()
            .get(&client_key(ip))
            .is_some_and(|(failures, start)| {
                now.saturating_sub(*start) < WINDOW_MS && *failures >= self.max_failures
            });
        if blocked {
            self.counters.blocked.fetch_add(1, Ordering::Relaxed);
        }
        blocked
    }

    pub fn record_failure(&self, ip: IpAddr, now: u64) {
        let mut clients = self.lock();
        let entry = clients.entry(client_key(ip)).or_insert((0, now));
        if now.saturating_sub(entry.1) >= WINDOW_MS {
            *entry = (0, now);
        }
        entry.0 = entry.0.saturating_add(1);
    }

    /// Clients currently refused
    pub fn blocked_clients(&self, now: u64) -> usize {
        self.lock()
            .values()
            .filter(|(failures, start)| {
                now.saturating_sub(*start) < WINDOW_MS && *failures >= self.max_failures
            })
            .count()
    }

    pub fn purge(&self, now: u64) {
        self.lock()
            .retain(|_, (_, start)| now.saturating_sub(*start) < WINDOW_MS);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ip(s: &str) -> IpAddr {
        s.parse().unwrap()
    }

    #[test]
    fn passkey_shape() {
        assert!(plausible_passkey("0123456789abcdef0123456789abcdef"));
        assert!(plausible_passkey(&"a".repeat(40)));
        assert!(!plausible_passkey("short"));
        assert!(!plausible_passkey(&"a".repeat(129)));
        assert!(!plausible_passkey("0123456789abcdef0123456789abcde'"));
        assert!(!plausible_passkey("0123456789abcdef 0123456789abcdef"));
    }

    #[test]
    fn blocks_after_budget_until_window_ends() {
        let limiter = FailureLimiter::new(3);
        let a = ip("203.0.113.5");
        for _ in 0..2 {
            limiter.record_failure(a, 0);
        }
        assert!(!limiter.is_blocked(a, 10));
        limiter.record_failure(a, 20);
        assert!(limiter.is_blocked(a, 30));
        assert!(!limiter.is_blocked(ip("203.0.113.6"), 30), "other client");
        assert_eq!(limiter.blocked_clients(30), 1);
        assert!(!limiter.is_blocked(a, WINDOW_MS), "window over");
        assert_eq!(limiter.counters.blocked.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn ipv6_grouped_by_64() {
        let limiter = FailureLimiter::new(2);
        limiter.record_failure(ip("2001:db8:1:2::1"), 0);
        limiter.record_failure(ip("2001:db8:1:2::ffff"), 0);
        assert!(limiter.is_blocked(ip("2001:db8:1:2:abcd::9"), 1));
        assert!(!limiter.is_blocked(ip("2001:db8:1:3::1"), 1));
    }

    #[test]
    fn purge_drops_old_windows() {
        let limiter = FailureLimiter::new(1);
        limiter.record_failure(ip("203.0.113.5"), 0);
        limiter.purge(WINDOW_MS);
        assert!(limiter.lock().is_empty());
    }
}
