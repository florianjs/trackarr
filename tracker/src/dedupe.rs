//! Clients announce on every interface (IPv4, IPv6...) at once: account
//! only the first announce per peer, torrent and event within a short window.

use std::collections::HashMap;
use std::sync::Mutex;

use crate::query::{Event, Hash};

pub const WINDOW_MS: u64 = 2000;

type Key = (Hash, Hash, u8);

#[derive(Default)]
pub struct Dedupe {
    seen: Mutex<HashMap<Key, u64>>,
}

fn event_tag(event: Event) -> u8 {
    match event {
        Event::Started => 0,
        Event::Stopped => 1,
        Event::Completed => 2,
        Event::Update => 3,
    }
}

impl Dedupe {
    /// True the first time within the window, false for duplicates.
    pub fn claim(&self, info_hash: &Hash, peer_id: &Hash, event: Event, now: u64) -> bool {
        let mut seen = self.seen.lock().unwrap_or_else(|p| p.into_inner());
        let key = (*info_hash, *peer_id, event_tag(event));
        match seen.get(&key) {
            Some(&until) if until > now => false,
            _ => {
                seen.insert(key, now + WINDOW_MS);
                true
            }
        }
    }

    pub fn purge(&self, now: u64) {
        let mut seen = self.seen.lock().unwrap_or_else(|p| p.into_inner());
        seen.retain(|_, until| *until > now);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn claims_once_per_window() {
        let dedupe = Dedupe::default();
        let (h, p) = ([1; 20], [2; 20]);
        assert!(dedupe.claim(&h, &p, Event::Update, 0));
        assert!(!dedupe.claim(&h, &p, Event::Update, 1999));
        assert!(dedupe.claim(&h, &p, Event::Stopped, 1999), "other event");
        assert!(dedupe.claim(&h, &p, Event::Update, 2000));
    }

    #[test]
    fn purge_forgets_expired() {
        let dedupe = Dedupe::default();
        dedupe.claim(&[1; 20], &[2; 20], Event::Update, 0);
        dedupe.purge(WINDOW_MS);
        assert!(dedupe.seen.lock().unwrap().is_empty());
    }
}
