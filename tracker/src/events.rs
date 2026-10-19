//! Abuse the web app should alert admins about. Queued in memory and pushed
//! to a capped Redis list (`tracker:abuse_events`) with the other periodic
//! writes; the app drains it (server/plugins/security-events.ts).

use std::sync::Mutex;

use serde::Serialize;

use crate::redis_store::RedisStore;

pub const KEY: &str = "tracker:abuse_events";
/// Events kept in Redis and in memory: older ones are dropped, an alert
/// storm needs no more to be noticed
const MAX_EVENTS: usize = 1000;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum AbuseEvent {
    /// Too many invalid passkeys / unknown torrents: refused for a minute
    BlockedClient { ip: String, failures: u32, at: u64 },
    /// Upload claimed beyond what the elapsed time allows (ratio cheat)
    ImpossibleUpload {
        ip: String,
        user_id: String,
        info_hash: String,
        claimed: u64,
        at: u64,
    },
}

#[derive(Default)]
pub struct AbuseEvents {
    queue: Mutex<Vec<AbuseEvent>>,
}

impl AbuseEvents {
    fn lock(&self) -> std::sync::MutexGuard<'_, Vec<AbuseEvent>> {
        self.queue.lock().unwrap_or_else(|p| p.into_inner())
    }

    pub fn report(&self, event: AbuseEvent) {
        let mut queue = self.lock();
        if queue.len() < MAX_EVENTS {
            queue.push(event);
        }
    }

    pub async fn flush(&self, redis: &RedisStore) -> Result<(), String> {
        let events = std::mem::take(&mut *self.lock());
        if events.is_empty() {
            return Ok(());
        }
        let key = redis.key(KEY);
        let mut pipe = redis::pipe();
        for event in &events {
            let json = serde_json::to_string(event).map_err(|e| e.to_string())?;
            pipe.lpush(&key, json).ignore();
        }
        pipe.ltrim(&key, 0, MAX_EVENTS as isize - 1).ignore();
        if let Err(err) = redis.query::<()>(&pipe).await {
            // Keep them for the next attempt, within the cap
            let mut queue = self.lock();
            let room = MAX_EVENTS.saturating_sub(queue.len());
            queue.extend(events.into_iter().take(room));
            return Err(err);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serializes_with_kind_tag() {
        let event = AbuseEvent::BlockedClient {
            ip: "203.0.113.5".into(),
            failures: 120,
            at: 42,
        };
        assert_eq!(
            serde_json::to_string(&event).unwrap(),
            r#"{"kind":"blocked_client","ip":"203.0.113.5","failures":120,"at":42}"#
        );
    }

    #[test]
    fn queue_is_capped() {
        let events = AbuseEvents::default();
        for i in 0..MAX_EVENTS + 5 {
            events.report(AbuseEvent::BlockedClient {
                ip: String::new(),
                failures: 0,
                at: i as u64,
            });
        }
        assert_eq!(events.lock().len(), MAX_EVENTS);
    }
}
