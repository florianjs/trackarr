//! In-memory swarms.
//!
//! Each swarm keeps seeders and leechers in two index maps: counts are their
//! lengths, and a random window of peers is picked in O(numwant) even in
//! swarms of thousands. Swarms are sharded by info hash so announces on
//! different torrents do not contend on one lock.

use std::collections::{HashMap, HashSet};
use std::net::IpAddr;
use std::sync::Mutex;

use indexmap::IndexMap;

use crate::query::{Event, Hash};
use crate::response::ResponsePeer;

/// Peers not refreshed within this window are gone (same as `PEER_TTL` in Node)
pub const PEER_TTL_MS: u64 = 1800 * 1000;
const SHARDS: usize = 64;

/// Interned id of the user owning a peer
pub type Owner = u32;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Peer {
    pub owner: Owner,
    pub ip: IpAddr,
    pub port: u16,
    pub uploaded: u64,
    pub downloaded: u64,
    pub left: Option<u64>,
    pub updated_at: u64,
}

#[derive(Default)]
struct Swarm {
    seeders: IndexMap<Hash, Peer>,
    leechers: IndexMap<Hash, Peer>,
    /// Owner → (seeders, leechers): caps peers per user, and keeps a user's
    /// own leechers out of the upload credit check
    owners: HashMap<Owner, (u16, u16)>,
}

/// Count a peer in or out of its owner's tally
fn tally(owners: &mut HashMap<Owner, (u16, u16)>, owner: Owner, seeder: bool, added: bool) {
    let entry = owners.entry(owner).or_default();
    let slot = if seeder { &mut entry.0 } else { &mut entry.1 };
    *slot = if added {
        slot.saturating_add(1)
    } else {
        slot.saturating_sub(1)
    };
    if *entry == (0, 0) {
        owners.remove(&owner);
    }
}

impl Swarm {
    fn is_empty(&self) -> bool {
        self.seeders.is_empty() && self.leechers.is_empty()
    }

    fn get(&self, peer_id: &Hash) -> Option<(&Peer, bool)> {
        self.seeders
            .get(peer_id)
            .map(|p| (p, true))
            .or_else(|| self.leechers.get(peer_id).map(|p| (p, false)))
    }

    fn remove(&mut self, peer_id: &Hash) -> Option<(Peer, bool)> {
        let removed = self
            .seeders
            .swap_remove(peer_id)
            .map(|p| (p, true))
            .or_else(|| self.leechers.swap_remove(peer_id).map(|p| (p, false)));
        if let Some((peer, seeder)) = &removed {
            tally(&mut self.owners, peer.owner, *seeder, false);
        }
        removed
    }

    fn insert(&mut self, peer_id: Hash, peer: Peer, seeder: bool) {
        tally(&mut self.owners, peer.owner, seeder, true);
        if seeder {
            self.seeders.insert(peer_id, peer);
        } else {
            self.leechers.insert(peer_id, peer);
        }
    }

    /// (seeders, leechers) owned by one user
    fn owned(&self, owner: Owner) -> (u16, u16) {
        self.owners.get(&owner).copied().unwrap_or_default()
    }

    fn counts(&self) -> (u32, u32) {
        (self.seeders.len() as u32, self.leechers.len() as u32)
    }

    /// Up to `numwant` peers other than `exclude`: leechers for a seeder, anyone for a leecher.
    fn select(&self, numwant: usize, exclude: &Hash, seeder: bool) -> Vec<ResponsePeer> {
        let mut out = Vec::with_capacity(numwant.min(self.seeders.len() + self.leechers.len()));
        if !seeder {
            take_window(&self.seeders, numwant, exclude, &mut out);
        }
        take_window(&self.leechers, numwant, exclude, &mut out);
        // Seeders first fills a leecher's list with seeders only; mix both instead
        if !seeder && out.len() > numwant {
            fastrand::shuffle(&mut out);
            out.truncate(numwant);
        }
        out
    }
}

/// A contiguous window starting at a random offset, wrapping around.
fn take_window(
    peers: &IndexMap<Hash, Peer>,
    numwant: usize,
    exclude: &Hash,
    out: &mut Vec<ResponsePeer>,
) {
    let len = peers.len();
    if len == 0 {
        return;
    }
    let start = fastrand::usize(..len);
    let mut taken = 0;
    for i in 0..len {
        if taken == numwant {
            break;
        }
        let Some((peer_id, peer)) = peers.get_index((start + i) % len) else {
            continue;
        };
        if peer_id == exclude {
            continue;
        }
        out.push(ResponsePeer {
            peer_id: *peer_id,
            ip: peer.ip,
            port: peer.port,
        });
        taken += 1;
    }
}

#[derive(Default)]
struct Shard {
    swarms: HashMap<Hash, Swarm>,
    /// Swarms whose counts changed since the last `take_dirty`
    dirty: HashSet<Hash>,
}

pub struct PeerUpdate {
    pub info_hash: Hash,
    pub peer_id: Hash,
    pub owner: Owner,
    pub ip: IpAddr,
    pub port: u16,
    pub uploaded: u64,
    pub downloaded: u64,
    pub left: Option<u64>,
    pub event: Event,
    pub numwant: usize,
    pub now: u64,
}

impl PeerUpdate {
    fn is_seeder(&self) -> bool {
        self.left == Some(0)
    }
}

/// State of the peer before this announce (live peers only)
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Previous {
    pub uploaded: u64,
    pub downloaded: u64,
    pub updated_at: u64,
    pub seeder: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Applied {
    Updated,
    Removed,
    /// The peer id belongs to another user's peer: left untouched
    NotOwner,
    /// New peer refused: the user already has the maximum on this torrent
    TooManyPeers,
}

#[derive(Debug)]
pub struct Outcome {
    pub previous: Option<Previous>,
    pub applied: Applied,
    /// Leechers of other users, before the update: a user's own leechers
    /// cannot justify upload credit
    pub other_leechers: u32,
    pub seeders: u32,
    pub leechers: u32,
    pub peers: Vec<ResponsePeer>,
}

/// A peer dropped by `expire` without a `stopped` announce
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Expired {
    pub info_hash: Hash,
    pub owner: Owner,
    pub seeder: bool,
}

#[derive(Debug, Default, PartialEq)]
pub struct SwarmStats {
    pub torrents: u64,
    /// Peer entries (a client in 10 swarms counts 10 times)
    pub seeders: u64,
    pub leechers: u64,
    /// Torrents with at least one seeder
    pub seeded_torrents: u64,
    /// Distinct ip:port
    pub unique_peers: u64,
    pub unique_seeders: u64,
    /// Owner → (seeding, leeching) torrents
    pub users: HashMap<Owner, (u32, u32)>,
}

/// Default cap on one user's peers in one swarm (several clients or machines)
pub const DEFAULT_MAX_PEERS_PER_USER: u16 = 3;

pub struct Swarms {
    shards: Vec<Mutex<Shard>>,
    max_peers_per_user: u16,
}

impl Default for Swarms {
    fn default() -> Self {
        Swarms::new(DEFAULT_MAX_PEERS_PER_USER)
    }
}

impl Swarms {
    pub fn new(max_peers_per_user: u16) -> Self {
        Swarms {
            shards: (0..SHARDS).map(|_| Mutex::default()).collect(),
            max_peers_per_user: max_peers_per_user.max(1),
        }
    }

    fn shard(&self, info_hash: &Hash) -> std::sync::MutexGuard<'_, Shard> {
        // Info hashes are SHA-1 output: the first byte is uniform enough
        let shard = &self.shards[info_hash[0] as usize % SHARDS];
        shard
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    pub fn announce(&self, update: &PeerUpdate) -> Outcome {
        let mut guard = self.shard(&update.info_hash);
        let shard = &mut *guard;
        let swarm = shard.swarms.entry(update.info_hash).or_default();

        let existing = swarm
            .get(&update.peer_id)
            .filter(|(peer, _)| update.now.saturating_sub(peer.updated_at) < PEER_TTL_MS)
            .map(|(peer, seeder)| {
                (
                    peer.owner,
                    Previous {
                        uploaded: peer.uploaded,
                        downloaded: peer.downloaded,
                        updated_at: peer.updated_at,
                        seeder,
                    },
                )
            });

        let own_leechers = u32::from(swarm.owned(update.owner).1);
        let other_leechers = match &existing {
            Some(_) => (swarm.leechers.len() as u32).saturating_sub(own_leechers),
            None => 0,
        };

        // A stale entry under the same peer id is replaced whoever owned it
        let not_owner = matches!(&existing, Some((owner, _)) if *owner != update.owner);
        let is_new = existing.is_none();
        let previous = existing.map(|(_, previous)| previous);
        let seeder = update.is_seeder();

        let applied = if not_owner {
            Applied::NotOwner
        } else if update.event == Event::Stopped {
            swarm.remove(&update.peer_id);
            Applied::Removed
        } else {
            let counts = swarm.counts();
            swarm.remove(&update.peer_id);
            let (own_seeders, own_leechers) = swarm.owned(update.owner);
            let applied = if is_new && own_seeders + own_leechers >= self.max_peers_per_user {
                Applied::TooManyPeers
            } else {
                let peer = Peer {
                    owner: update.owner,
                    ip: update.ip,
                    port: update.port,
                    uploaded: update.uploaded,
                    downloaded: update.downloaded,
                    left: update.left,
                    updated_at: update.now,
                };
                swarm.insert(update.peer_id, peer, seeder);
                Applied::Updated
            };
            if swarm.counts() != counts {
                shard.dirty.insert(update.info_hash);
            }
            applied
        };

        let peers = if matches!(applied, Applied::Removed | Applied::TooManyPeers) {
            Vec::new()
        } else {
            swarm.select(update.numwant, &update.peer_id, seeder)
        };
        let (seeders, leechers) = swarm.counts();

        if applied == Applied::Removed && previous.is_some() {
            shard.dirty.insert(update.info_hash);
        }
        if swarm.is_empty() {
            shard.swarms.remove(&update.info_hash);
        }

        Outcome {
            previous,
            applied,
            other_leechers,
            seeders,
            leechers,
            peers,
        }
    }

    /// (seeders, leechers), zero for unknown swarms
    pub fn counts(&self, info_hash: &Hash) -> (u32, u32) {
        self.shard(info_hash)
            .swarms
            .get(info_hash)
            .map_or((0, 0), Swarm::counts)
    }

    /// Drop a swarm entirely (torrent deleted)
    pub fn remove_swarm(&self, info_hash: &Hash) {
        let mut shard = self.shard(info_hash);
        if shard.swarms.remove(info_hash).is_some() {
            shard.dirty.insert(*info_hash);
        }
    }

    /// Remove peers older than the TTL and empty swarms.
    pub fn expire(&self, now: u64) -> Vec<Expired> {
        let mut expired = Vec::new();
        for shard in &self.shards {
            let mut guard = shard
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let shard = &mut *guard;
            shard.swarms.retain(|info_hash, swarm| {
                let before = swarm.counts();
                let owners = &mut swarm.owners;
                for (peers, seeder) in [(&mut swarm.seeders, true), (&mut swarm.leechers, false)] {
                    peers.retain(|_, peer| {
                        let live = now.saturating_sub(peer.updated_at) < PEER_TTL_MS;
                        if !live {
                            tally(owners, peer.owner, seeder, false);
                            expired.push(Expired {
                                info_hash: *info_hash,
                                owner: peer.owner,
                                seeder,
                            });
                        }
                        live
                    });
                }
                if swarm.counts() != before {
                    shard.dirty.insert(*info_hash);
                }
                !swarm.is_empty()
            });
        }
        expired
    }

    /// Live peers of a swarm with their seeder flag (internal API)
    pub fn peers(&self, info_hash: &Hash) -> Vec<(Peer, bool)> {
        let shard = self.shard(info_hash);
        let Some(swarm) = shard.swarms.get(info_hash) else {
            return Vec::new();
        };
        swarm
            .seeders
            .values()
            .map(|p| (p.clone(), true))
            .chain(swarm.leechers.values().map(|p| (p.clone(), false)))
            .collect()
    }

    /// (swarms, seeders, leechers): cheap, no peer walk
    pub fn totals(&self) -> (u64, u64, u64) {
        let mut totals = (0, 0, 0);
        for shard in &self.shards {
            let shard = shard.lock().unwrap_or_else(|p| p.into_inner());
            totals.0 += shard.swarms.len() as u64;
            for swarm in shard.swarms.values() {
                let (seeders, leechers) = swarm.counts();
                totals.1 += u64::from(seeders);
                totals.2 += u64::from(leechers);
            }
        }
        totals
    }

    /// Every peer as (info hash, peer id, peer, seeder), for the shutdown snapshot
    pub fn snapshot(&self) -> Vec<(Hash, Hash, Peer, bool)> {
        let mut out = Vec::new();
        for shard in &self.shards {
            let shard = shard.lock().unwrap_or_else(|p| p.into_inner());
            for (info_hash, swarm) in &shard.swarms {
                for (peers, seeder) in [(&swarm.seeders, true), (&swarm.leechers, false)] {
                    out.extend(
                        peers
                            .iter()
                            .map(|(id, p)| (*info_hash, *id, p.clone(), seeder)),
                    );
                }
            }
        }
        out
    }

    /// Put back a peer from a snapshot
    pub fn restore(&self, info_hash: Hash, peer_id: Hash, peer: Peer, seeder: bool) {
        let mut guard = self.shard(&info_hash);
        let shard = &mut *guard;
        let swarm = shard.swarms.entry(info_hash).or_default();
        swarm.remove(&peer_id);
        swarm.insert(peer_id, peer, seeder);
        shard.dirty.insert(info_hash);
    }

    /// Flag swarms again after a failed publish
    pub fn mark_dirty(&self, info_hashes: impl IntoIterator<Item = Hash>) {
        for info_hash in info_hashes {
            self.shard(&info_hash).dirty.insert(info_hash);
        }
    }

    /// Counts of every swarm (full resync of the published counters)
    pub fn all_counts(&self) -> Vec<(Hash, (u32, u32))> {
        let mut out = Vec::new();
        for shard in &self.shards {
            let shard = shard.lock().unwrap_or_else(|p| p.into_inner());
            out.extend(shard.swarms.iter().map(|(h, s)| (*h, s.counts())));
        }
        out
    }

    /// Site-wide numbers and per-user activity, one shard lock at a time
    pub fn stats(&self) -> SwarmStats {
        let mut stats = SwarmStats::default();
        let mut unique: HashSet<(IpAddr, u16)> = HashSet::new();
        let mut unique_seeders: HashSet<(IpAddr, u16)> = HashSet::new();
        for shard in &self.shards {
            let shard = shard.lock().unwrap_or_else(|p| p.into_inner());
            for swarm in shard.swarms.values() {
                let (seeders, leechers) = swarm.counts();
                stats.torrents += 1;
                stats.seeders += u64::from(seeders);
                stats.leechers += u64::from(leechers);
                if seeders > 0 {
                    stats.seeded_torrents += 1;
                }
                for peer in swarm.seeders.values() {
                    unique.insert((peer.ip, peer.port));
                    unique_seeders.insert((peer.ip, peer.port));
                    stats.users.entry(peer.owner).or_default().0 += 1;
                }
                for peer in swarm.leechers.values() {
                    unique.insert((peer.ip, peer.port));
                    stats.users.entry(peer.owner).or_default().1 += 1;
                }
            }
        }
        stats.unique_peers = unique.len() as u64;
        stats.unique_seeders = unique_seeders.len() as u64;
        stats
    }

    /// Swarms whose counts changed since the last call, with their current counts
    pub fn take_dirty(&self) -> Vec<(Hash, (u32, u32))> {
        let mut out = Vec::new();
        for shard in &self.shards {
            let mut guard = shard
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            let shard = &mut *guard;
            for info_hash in shard.dirty.drain() {
                let counts = shard.swarms.get(&info_hash).map_or((0, 0), Swarm::counts);
                out.push((info_hash, counts));
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH: Hash = [1; 20];

    fn update(peer: u8, owner: Owner, left: Option<u64>, event: Event, now: u64) -> PeerUpdate {
        PeerUpdate {
            info_hash: HASH,
            peer_id: [peer; 20],
            owner,
            ip: format!("10.0.0.{peer}").parse().unwrap(),
            port: 6881,
            uploaded: 100 * u64::from(peer),
            downloaded: 0,
            left,
            event,
            numwant: 50,
            now,
        }
    }

    #[test]
    fn first_announce_has_no_previous() {
        let swarms = Swarms::default();
        let out = swarms.announce(&update(1, 1, Some(10), Event::Started, 1000));
        assert_eq!(out.previous, None);
        assert_eq!(out.applied, Applied::Updated);
        assert_eq!((out.seeders, out.leechers), (0, 1));
        assert!(out.peers.is_empty(), "never returns the peer itself");
    }

    #[test]
    fn update_returns_previous_and_flips_to_seeder() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 1000));
        swarms.announce(&update(2, 2, Some(10), Event::Started, 1000));
        let out = swarms.announce(&update(1, 1, Some(0), Event::Completed, 5000));
        assert_eq!(
            out.previous,
            Some(Previous {
                uploaded: 100,
                downloaded: 0,
                updated_at: 1000,
                seeder: false
            })
        );
        assert_eq!(out.other_leechers, 1);
        assert_eq!((out.seeders, out.leechers), (1, 1));
        assert_eq!(swarms.counts(&HASH), (1, 1));
    }

    #[test]
    fn seeders_only_get_leechers() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(0), Event::Started, 0));
        swarms.announce(&update(2, 2, Some(0), Event::Started, 0));
        swarms.announce(&update(3, 3, Some(5), Event::Started, 0));
        let out = swarms.announce(&update(1, 1, Some(0), Event::Update, 10));
        assert_eq!(out.peers.len(), 1);
        assert_eq!(out.peers[0].peer_id, [3; 20]);

        let out = swarms.announce(&update(3, 3, Some(5), Event::Update, 10));
        assert_eq!(out.peers.len(), 2);
    }

    #[test]
    fn numwant_limits_and_mixes() {
        let swarms = Swarms::default();
        for peer in 1..=40 {
            let left = if peer % 2 == 0 { Some(0) } else { Some(1) };
            swarms.announce(&update(peer, u32::from(peer), left, Event::Started, 0));
        }
        let mut req = update(41, 41, Some(1), Event::Started, 0);
        req.numwant = 10;
        let out = swarms.announce(&req);
        assert_eq!(out.peers.len(), 10);
        let unique: HashSet<_> = out.peers.iter().map(|p| p.peer_id).collect();
        assert_eq!(unique.len(), 10);
        assert!(!unique.contains(&[41; 20]));
    }

    #[test]
    fn stopped_removes_peer_and_empty_swarm() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 0));
        swarms.take_dirty();
        let out = swarms.announce(&update(1, 1, Some(10), Event::Stopped, 10));
        assert_eq!(out.applied, Applied::Removed);
        assert!(out.previous.is_some());
        assert!(out.peers.is_empty());
        assert_eq!(swarms.counts(&HASH), (0, 0));
        assert_eq!(swarms.take_dirty(), vec![(HASH, (0, 0))]);
    }

    #[test]
    fn other_users_peer_is_not_overwritten() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 0));
        let out = swarms.announce(&update(1, 2, Some(0), Event::Update, 10));
        assert_eq!(out.applied, Applied::NotOwner);
        assert_eq!(swarms.counts(&HASH), (0, 1));
        let out = swarms.announce(&update(1, 2, Some(0), Event::Stopped, 10));
        assert_eq!(out.applied, Applied::NotOwner);
        assert_eq!(swarms.counts(&HASH), (0, 1));
    }

    #[test]
    fn stale_peer_counts_as_new_and_can_be_taken_over() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 0));
        let out = swarms.announce(&update(1, 2, Some(10), Event::Started, PEER_TTL_MS));
        assert_eq!(out.previous, None);
        assert_eq!(out.applied, Applied::Updated);
        assert_eq!(swarms.counts(&HASH), (0, 1));
    }

    #[test]
    fn expire_drops_old_peers() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(0), Event::Started, 0));
        swarms.announce(&update(2, 2, Some(10), Event::Started, PEER_TTL_MS));
        swarms.take_dirty();
        let expired = swarms.expire(PEER_TTL_MS + 1);
        assert_eq!(
            expired,
            vec![Expired {
                info_hash: HASH,
                owner: 1,
                seeder: true
            }]
        );
        assert_eq!(swarms.counts(&HASH), (0, 1));
        assert_eq!(swarms.take_dirty(), vec![(HASH, (0, 1))]);
        swarms.expire(PEER_TTL_MS * 3);
        assert_eq!(swarms.counts(&HASH), (0, 0));
    }

    #[test]
    fn stats_count_unique_endpoints_and_users() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(0), Event::Started, 0));
        swarms.announce(&update(2, 2, Some(10), Event::Started, 0));
        // Same client (ip:port) seeding a second torrent
        let mut other = update(1, 1, Some(0), Event::Started, 0);
        other.info_hash = [2; 20];
        swarms.announce(&other);

        let stats = swarms.stats();
        assert_eq!(stats.torrents, 2);
        assert_eq!((stats.seeders, stats.leechers), (2, 1));
        assert_eq!(stats.seeded_torrents, 2);
        assert_eq!((stats.unique_peers, stats.unique_seeders), (2, 1));
        assert_eq!(stats.users[&1], (2, 0));
        assert_eq!(stats.users[&2], (0, 1));

        let mut all = swarms.all_counts();
        all.sort();
        assert_eq!(all, vec![(HASH, (1, 1)), ([2; 20], (1, 0))]);
    }

    #[test]
    fn caps_peers_per_user() {
        let swarms = Swarms::new(2);
        swarms.announce(&update(1, 7, Some(10), Event::Started, 0));
        swarms.announce(&update(2, 7, Some(10), Event::Started, 0));
        let out = swarms.announce(&update(3, 7, Some(10), Event::Started, 0));
        assert_eq!(out.applied, Applied::TooManyPeers);
        assert!(out.peers.is_empty());
        assert_eq!(swarms.counts(&HASH), (0, 2));
        // Known peers keep announcing, other users are not affected
        let out = swarms.announce(&update(1, 7, Some(0), Event::Update, 10));
        assert_eq!(out.applied, Applied::Updated);
        let out = swarms.announce(&update(4, 8, Some(10), Event::Started, 10));
        assert_eq!(out.applied, Applied::Updated);
        // A stopped peer frees a slot
        swarms.announce(&update(2, 7, Some(10), Event::Stopped, 20));
        let out = swarms.announce(&update(3, 7, Some(10), Event::Started, 20));
        assert_eq!(out.applied, Applied::Updated);
    }

    #[test]
    fn expired_peers_free_slots() {
        let swarms = Swarms::new(1);
        swarms.announce(&update(1, 7, Some(10), Event::Started, 0));
        swarms.expire(PEER_TTL_MS + 1);
        let out = swarms.announce(&update(2, 7, Some(10), Event::Started, PEER_TTL_MS + 2));
        assert_eq!(out.applied, Applied::Updated);
    }

    #[test]
    fn own_leechers_do_not_justify_upload() {
        let swarms = Swarms::default();
        // One user seeds and leeches the same torrent from two clients
        swarms.announce(&update(1, 7, Some(0), Event::Started, 0));
        swarms.announce(&update(2, 7, Some(10), Event::Started, 0));
        let out = swarms.announce(&update(1, 7, Some(0), Event::Update, 10));
        assert_eq!(out.other_leechers, 0);
        // Another user's leecher counts
        swarms.announce(&update(3, 8, Some(10), Event::Started, 10));
        let out = swarms.announce(&update(1, 7, Some(0), Event::Update, 20));
        assert_eq!(out.other_leechers, 1);
    }

    #[test]
    fn lists_peers_and_totals() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(0), Event::Started, 0));
        swarms.announce(&update(2, 2, Some(10), Event::Started, 0));
        let mut peers = swarms.peers(&HASH);
        peers.sort_by_key(|(p, _)| p.owner);
        assert_eq!(peers.len(), 2);
        assert!(peers[0].1 && !peers[1].1);
        assert!(swarms.peers(&[9; 20]).is_empty());
        assert_eq!(swarms.totals(), (1, 1, 1));
        swarms.remove_swarm(&HASH);
        assert_eq!(swarms.totals(), (0, 0, 0));
    }

    #[test]
    fn mark_dirty_requeues() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 0));
        let dirty = swarms.take_dirty();
        swarms.mark_dirty(dirty.iter().map(|(h, _)| *h));
        assert_eq!(swarms.take_dirty(), dirty);
    }

    #[test]
    fn refresh_without_count_change_is_not_dirty() {
        let swarms = Swarms::default();
        swarms.announce(&update(1, 1, Some(10), Event::Started, 0));
        swarms.take_dirty();
        swarms.announce(&update(1, 1, Some(5), Event::Update, 10));
        assert!(swarms.take_dirty().is_empty());
    }
}
