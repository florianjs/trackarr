//! Cache invalidation sent by the web app on `<prefix>tracker:invalidate`
//! after bans, role or passkey changes, torrent moderation and settings
//! updates. Caches expire after 30 s anyway: a missed message is late, never
//! permanent. After any (re)connection everything is invalidated, since
//! messages may have been missed meanwhile.

use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;

use crate::query::Hash;
use crate::tracker::Tracker;

pub const CHANNEL: &str = "tracker:invalidate";

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Invalidation {
    Users,
    Torrents,
    /// Torrent deleted: its swarm goes too
    Torrent(Hash),
    Settings,
}

pub fn parse_message(message: &str) -> Option<Invalidation> {
    match message.trim() {
        "users" => Some(Invalidation::Users),
        "torrents" => Some(Invalidation::Torrents),
        "settings" => Some(Invalidation::Settings),
        other => {
            let hex = other.strip_prefix("torrent:")?;
            parse_hex_hash(hex).map(Invalidation::Torrent)
        }
    }
}

/// 40 hex chars, either case
pub fn parse_hex_hash(hex: &str) -> Option<Hash> {
    if hex.len() != 40 {
        return None;
    }
    let mut hash = [0u8; 20];
    for (i, byte) in hash.iter_mut().enumerate() {
        *byte = u8::from_str_radix(hex.get(i * 2..i * 2 + 2)?, 16).ok()?;
    }
    Some(hash)
}

pub fn spawn_subscriber(tracker: Arc<Tracker>) {
    tokio::spawn(async move {
        let channel = tracker.redis.key(CHANNEL);
        loop {
            match tracker.redis.pubsub().await {
                Ok(mut pubsub) => match pubsub.subscribe(&channel).await {
                    Ok(()) => {
                        tracing::info!("listening for invalidations on {channel}");
                        tracker.invalidate_all().await;
                        let mut messages = pubsub.on_message();
                        while let Some(msg) = messages.next().await {
                            let payload: String = msg.get_payload().unwrap_or_default();
                            match parse_message(&payload) {
                                Some(invalidation) => tracker.apply(invalidation).await,
                                None => tracing::warn!("ignored invalidation {payload:?}"),
                            }
                        }
                        tracing::warn!("invalidation channel closed, reconnecting");
                    }
                    Err(err) => tracing::warn!("cannot subscribe to {channel}: {err}"),
                },
                Err(err) => tracing::warn!("invalidation channel unavailable: {err}"),
            }
            tokio::time::sleep(Duration::from_secs(2)).await;
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_messages() {
        assert_eq!(parse_message("users"), Some(Invalidation::Users));
        assert_eq!(parse_message("torrents\n"), Some(Invalidation::Torrents));
        assert_eq!(parse_message("settings"), Some(Invalidation::Settings));
        assert_eq!(
            parse_message("torrent:0123456789abcdef0123456789ABCDEF01234567"),
            Some(Invalidation::Torrent([
                0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45, 0x67, 0x89, 0xab,
                0xcd, 0xef, 0x01, 0x23, 0x45, 0x67
            ]))
        );
        assert_eq!(parse_message("torrent:abc"), None);
        assert_eq!(
            parse_message("torrent:zz23456789abcdef0123456789abcdef01234567"),
            None
        );
        assert_eq!(parse_message("everything"), None);
    }
}
