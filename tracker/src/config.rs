//! Environment configuration, same variable names as the Node tracker.

use std::env;

use crate::client_ip::parse_trusted_hops;
use crate::credit::DEFAULT_MAX_RATE_BYTES;
use crate::swarms::DEFAULT_MAX_PEERS_PER_USER;

#[derive(Debug, Clone)]
pub struct Config {
    pub http_port: u16,
    /// Reverse proxies in front that append to `X-Forwarded-For` (0: header ignored)
    pub trusted_hops: usize,
    /// Seconds between announces sent to clients
    pub interval: u32,
    pub debug: bool,
    /// Upload/download credit ceiling per peer
    pub max_rate_bytes: u64,
    /// Seconds between accounting flushes to Postgres
    pub flush_interval: u64,
    /// Entries per lookup cache (users, torrents)
    pub cache_capacity: u64,
    /// Seconds between site-wide stats passes
    pub stats_interval: u64,
    /// Seconds after start before publishing counters (swarms refilling)
    pub warmup: u64,
    /// Private API port (health, metrics, swarm peers for the web app)
    pub internal_port: u16,
    /// Failed lookups (bad passkey, unknown torrent) per client and minute
    /// before its requests are refused without touching the database
    pub max_failures_per_minute: u32,
    /// HTTP header timeout and connection cap (both listeners)
    pub limits: crate::server::Limits,
    /// Peers one user may have in one swarm
    pub max_peers_per_user: u16,
    /// Where swarms are saved on shutdown and loaded on start (disabled if unset)
    pub snapshot_path: Option<std::path::PathBuf>,
}

impl Config {
    pub fn from_env() -> Result<Self, String> {
        let interval = parse_or("TRACKER_INTERVAL", 600)?;
        Ok(Config {
            http_port: parse_or("TRACKER_HTTP_PORT", 8080)?,
            trusted_hops: parse_trusted_hops(env::var("TRACKER_TRUST_PROXY").ok().as_deref())?,
            interval,
            debug: env::var("TRACKER_DEBUG").as_deref() == Ok("true"),
            max_rate_bytes: max_rate_bytes(),
            flush_interval: parse_or::<u64>("TRACKER_FLUSH_INTERVAL", 5)?.max(1),
            cache_capacity: parse_or("TRACKER_CACHE_CAPACITY", 500_000)?,
            stats_interval: parse_or::<u64>("TRACKER_STATS_INTERVAL", 60)?.max(5),
            warmup: parse_or("TRACKER_WARMUP", u64::from(interval) + 60)?,
            internal_port: parse_or("TRACKER_INTERNAL_PORT", 8090)?,
            max_failures_per_minute: parse_or(
                "TRACKER_MAX_FAILURES_PER_MINUTE",
                crate::abuse::DEFAULT_MAX_FAILURES,
            )?,
            limits: crate::server::Limits {
                header_timeout: std::time::Duration::from_secs(
                    parse_or::<u64>("TRACKER_HEADER_TIMEOUT_SECS", 10)?.max(1),
                ),
                max_connections: parse_or("TRACKER_MAX_CONNECTIONS", 10_000)?,
            },
            max_peers_per_user: parse_or("TRACKER_MAX_PEERS_PER_USER", DEFAULT_MAX_PEERS_PER_USER)?,
            snapshot_path: env::var("TRACKER_SNAPSHOT_PATH")
                .ok()
                .filter(|p| !p.trim().is_empty())
                .map(Into::into),
        })
    }
}

fn parse_or<T: std::str::FromStr>(key: &str, default: T) -> Result<T, String> {
    match env::var(key) {
        Ok(value) if !value.trim().is_empty() => value
            .trim()
            .parse()
            .map_err(|_| format!("{key} is not a valid value: {value:?}")),
        _ => Ok(default),
    }
}

/// `TRACKER_MAX_RATE_MIBPS`; invalid or non-positive values keep the default
fn max_rate_bytes() -> u64 {
    env::var("TRACKER_MAX_RATE_MIBPS")
        .ok()
        .and_then(|v| v.trim().parse::<f64>().ok())
        .filter(|mibps| mibps.is_finite() && *mibps > 0.0)
        .map_or(DEFAULT_MAX_RATE_BYTES, |mibps| {
            (mibps * 1024.0 * 1024.0) as u64
        })
}

/// Read a secret from the file named by `<KEY>_FILE` (Docker secrets), else
/// from `<KEY>`. Mirrors `server/utils/secrets.ts`.
pub fn read_secret(key: &str) -> Option<String> {
    if let Ok(path) = env::var(format!("{key}_FILE")) {
        match std::fs::read_to_string(&path) {
            Ok(secret) if !secret.trim().is_empty() => return Some(secret.trim().to_owned()),
            Ok(_) => {}
            Err(err) => tracing::warn!("cannot read secret file {path}: {err}"),
        }
    }
    env::var(key).ok().filter(|v| !v.is_empty())
}
