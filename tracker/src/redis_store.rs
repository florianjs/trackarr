//! Redis connection, direct or through Sentinel, configured like
//! `server/redis/client.ts` (same variables, same key prefix).
//!
//! Redis is off the announce path: if it is down, announces keep working and
//! only published counters go stale. The connection is dropped on any error
//! and rebuilt on the next call, which re-asks Sentinel for the master.

use std::env;
use std::time::Duration;

use redis::aio::MultiplexedConnection;
use redis::sentinel::{SentinelClient, SentinelClientBuilder, SentinelServerType};
use redis::{ConnectionAddr, FromRedisValue, IntoConnectionInfo, Pipeline};
use tokio::sync::Mutex;

use crate::config::read_secret;

enum Source {
    Direct(redis::Client),
    Sentinel(Mutex<SentinelClient>),
}

pub struct RedisStore {
    source: Source,
    conn: Mutex<Option<MultiplexedConnection>>,
    prefix: String,
    timeout: Duration,
}

/// `REDIS_SENTINELS` ("host1:26379,host2:26379"), as `parseSentinels`
pub fn parse_sentinels(value: &str) -> Result<Vec<(String, u16)>, String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|entry| !entry.is_empty())
        .map(|entry| {
            let (host, port) = match entry.rsplit_once(':') {
                Some((host, port)) if !host.is_empty() => (host, port.parse::<u16>().ok()),
                _ => (entry, Some(26379)),
            };
            match port {
                Some(port) if port > 0 && !host.is_empty() => Ok((host.to_owned(), port)),
                _ => Err(format!("Invalid REDIS_SENTINELS entry: \"{entry}\"")),
            }
        })
        .collect()
}

impl RedisStore {
    pub fn from_env() -> Result<Self, String> {
        let url = env::var("REDIS_URL").unwrap_or_else(|_| "redis://localhost:6379".into());
        if env::var("REDIS_TLS").as_deref() == Ok("true") || url.starts_with("rediss://") {
            return Err("Redis TLS is not supported by the tracker yet".into());
        }
        let password = read_secret("REDIS_PASSWORD");
        let sentinels = parse_sentinels(&env::var("REDIS_SENTINELS").unwrap_or_default())?;

        let source = if sentinels.is_empty() {
            let mut info = url
                .as_str()
                .into_connection_info()
                .map_err(|err| format!("invalid REDIS_URL: {err}"))?;
            if let Some(password) = &password {
                let settings = info.redis_settings().clone().set_password(password);
                info = info.set_redis_settings(settings);
            }
            Source::Direct(redis::Client::open(info).map_err(|e| e.to_string())?)
        } else {
            let name = env::var("REDIS_SENTINEL_NAME").unwrap_or_else(|_| "mymaster".into());
            let addrs = sentinels
                .into_iter()
                .map(|(host, port)| ConnectionAddr::Tcp(host, port));
            let mut builder = SentinelClientBuilder::new(addrs, name, SentinelServerType::Master)
                .map_err(|e| e.to_string())?;
            if let Some(password) = &password {
                builder = builder.set_client_to_redis_password(password);
            }
            if let Some(password) = read_secret("REDIS_SENTINEL_PASSWORD") {
                builder = builder.set_client_to_sentinel_password(password);
            }
            Source::Sentinel(Mutex::new(builder.build().map_err(|e| e.to_string())?))
        };

        let timeout_ms = env::var("REDIS_COMMAND_TIMEOUT_MS")
            .ok()
            .and_then(|v| v.parse::<u64>().ok())
            .filter(|ms| *ms > 0)
            .unwrap_or(5000);
        Ok(RedisStore {
            source,
            conn: Mutex::new(None),
            prefix: env::var("REDIS_KEY_PREFIX").unwrap_or_else(|_| "ot:".into()),
            timeout: Duration::from_millis(timeout_ms),
        })
    }

    /// Key with the shared prefix (ioredis `keyPrefix`)
    pub fn key(&self, key: &str) -> String {
        format!("{}{key}", self.prefix)
    }

    async fn connection(&self) -> Result<MultiplexedConnection, String> {
        let mut cached = self.conn.lock().await;
        if let Some(conn) = cached.as_ref() {
            return Ok(conn.clone());
        }
        // A vanished datacenter drops packets silently: never wait forever
        let connect = async {
            match &self.source {
                Source::Direct(client) => client.get_multiplexed_async_connection().await,
                Source::Sentinel(client) => client.lock().await.get_async_connection().await,
            }
        };
        let conn = tokio::time::timeout(self.timeout, connect)
            .await
            .map_err(|_| "Redis connection timed out".to_owned())?
            .map_err(|e| format!("Redis connection failed: {e}"))?;
        *cached = Some(conn.clone());
        Ok(conn)
    }

    /// Dedicated pub/sub connection (to the current master under Sentinel)
    pub async fn pubsub(&self) -> Result<redis::aio::PubSub, String> {
        let client = match &self.source {
            Source::Direct(client) => client.clone(),
            Source::Sentinel(client) => client
                .lock()
                .await
                .async_get_client()
                .await
                .map_err(|e| e.to_string())?,
        };
        tokio::time::timeout(self.timeout, client.get_async_pubsub())
            .await
            .map_err(|_| "Redis connection timed out".to_owned())?
            .map_err(|e| format!("Redis pub/sub connection failed: {e}"))
    }

    /// Run a pipeline; any failure drops the connection for the next call.
    pub async fn query<T: FromRedisValue>(&self, pipe: &Pipeline) -> Result<T, String> {
        let mut conn = self.connection().await?;
        let result = tokio::time::timeout(self.timeout, pipe.query_async::<T>(&mut conn)).await;
        let err = match result {
            Ok(Ok(value)) => return Ok(value),
            Ok(Err(err)) => err.to_string(),
            Err(_) => "Redis command timed out".to_owned(),
        };
        *self.conn.lock().await = None;
        Err(err)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_sentinels() {
        assert_eq!(
            parse_sentinels("10.0.0.1:26379, 10.0.0.2:26380,10.0.0.3").unwrap(),
            vec![
                ("10.0.0.1".to_owned(), 26379),
                ("10.0.0.2".to_owned(), 26380),
                ("10.0.0.3".to_owned(), 26379),
            ]
        );
        assert!(parse_sentinels("").unwrap().is_empty());
        assert!(parse_sentinels("host:0").is_err());
        assert!(parse_sentinels("host:abc").is_err());
    }
}
