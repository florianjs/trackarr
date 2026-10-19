//! Postgres pool. `tokio-postgres` understands the multi-host URLs used by
//! replicated deployments (`postgres://u:p@h1,h2/db?target_session_attrs=...`).

use std::env;
use std::str::FromStr;
use std::time::Duration;

use deadpool_postgres::{Manager, ManagerConfig, Pool, RecyclingMethod, Runtime};
use tokio_postgres::NoTls;

pub fn pool() -> Result<Pool, String> {
    if env::var("DB_SSL").as_deref() == Ok("true") {
        return Err("DB_SSL=true is not supported by the tracker yet".into());
    }
    let url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://tracker:tracker@localhost:5432/trackarr".into());
    let mut config = tokio_postgres::Config::from_str(&normalize_url(&url))
        .map_err(|err| format!("invalid DATABASE_URL: {err}"))?;
    let connect_timeout = Duration::from_secs(env_u64("DB_CONNECT_TIMEOUT", 10));
    config.connect_timeout(connect_timeout);
    config.keepalives_idle(Duration::from_secs(env_u64("DB_KEEP_ALIVE", 60).max(1)));

    let manager = Manager::from_config(
        config,
        NoTls,
        ManagerConfig {
            recycling_method: RecyclingMethod::Fast,
        },
    );
    Pool::builder(manager)
        .max_size(env_u64("DB_POOL_MAX", 16) as usize)
        // A slow database must fail announces fast, not queue them forever
        .runtime(Runtime::Tokio1)
        .wait_timeout(Some(Duration::from_millis(env_u64(
            "DB_POOL_WAIT_MS",
            2000,
        ))))
        .create_timeout(Some(connect_timeout))
        .build()
        .map_err(|err| format!("cannot build database pool: {err}"))
}

/// libpq's `primary` (used by the Node app) is `read-write` for tokio-postgres.
fn normalize_url(url: &str) -> String {
    url.replace(
        "target_session_attrs=primary",
        "target_session_attrs=read-write",
    )
}

fn env_u64(key: &str, default: u64) -> u64 {
    env::var(key)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn multi_host_url_parses() {
        let url = normalize_url(
            "postgres://tracker:pw@10.0.0.1:5432,10.0.0.2:5432/trackarr?target_session_attrs=primary",
        );
        let config = tokio_postgres::Config::from_str(&url).unwrap();
        assert_eq!(config.get_hosts().len(), 2);
        assert_eq!(config.get_dbname(), Some("trackarr"));
    }
}
