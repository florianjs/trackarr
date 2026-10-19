//! Swarms saved on graceful shutdown and loaded on start, so a deploy loses
//! neither peer lists nor credit baselines (the first announce after a
//! restart would otherwise only set a new baseline).
//!
//! Binary format, little endian:
//!   magic "TRKSNAP" + version u8, saved_at u64 (ms), count u64, then per peer:
//!   info_hash [20], peer_id [20], user id (u16 len + bytes), ip (u8 4|6 +
//!   octets), port u16, uploaded u64, downloaded u64, left (u8 0|1 + u64),
//!   updated_at u64, seeder u8
//!
//! The file holds raw peer IPs (as the tracker's memory does): keep it on a
//! local volume only.

use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::Path;

use crate::query::Hash;
use crate::swarms::{PEER_TTL_MS, Peer};

const MAGIC: &[u8; 7] = b"TRKSNAP";
const VERSION: u8 = 1;

/// A peer with its owner as a user id: interned owners differ between runs
#[derive(Debug, Clone, PartialEq)]
pub struct Entry {
    pub info_hash: Hash,
    pub peer_id: Hash,
    pub user_id: String,
    pub peer: Peer,
    pub seeder: bool,
}

#[derive(Debug)]
pub struct Snapshot {
    pub saved_at: u64,
    pub entries: Vec<Entry>,
}

pub fn encode(saved_at: u64, entries: &[Entry]) -> Vec<u8> {
    let mut out = Vec::with_capacity(32 + entries.len() * 128);
    out.extend_from_slice(MAGIC);
    out.push(VERSION);
    out.extend_from_slice(&saved_at.to_le_bytes());
    out.extend_from_slice(&(entries.len() as u64).to_le_bytes());
    for e in entries {
        out.extend_from_slice(&e.info_hash);
        out.extend_from_slice(&e.peer_id);
        let id = e.user_id.as_bytes();
        out.extend_from_slice(&(id.len().min(u16::MAX as usize) as u16).to_le_bytes());
        out.extend_from_slice(&id[..id.len().min(u16::MAX as usize)]);
        match e.peer.ip {
            IpAddr::V4(ip) => {
                out.push(4);
                out.extend_from_slice(&ip.octets());
            }
            IpAddr::V6(ip) => {
                out.push(6);
                out.extend_from_slice(&ip.octets());
            }
        }
        out.extend_from_slice(&e.peer.port.to_le_bytes());
        out.extend_from_slice(&e.peer.uploaded.to_le_bytes());
        out.extend_from_slice(&e.peer.downloaded.to_le_bytes());
        match e.peer.left {
            Some(left) => {
                out.push(1);
                out.extend_from_slice(&left.to_le_bytes());
            }
            None => {
                out.push(0);
                out.extend_from_slice(&0u64.to_le_bytes());
            }
        }
        out.extend_from_slice(&e.peer.updated_at.to_le_bytes());
        out.push(u8::from(e.seeder));
    }
    out
}

struct Reader<'a> {
    data: &'a [u8],
    pos: usize,
}

impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> Result<&'a [u8], String> {
        let end = self
            .pos
            .checked_add(n)
            .filter(|end| *end <= self.data.len());
        let end = end.ok_or("truncated snapshot")?;
        let bytes = &self.data[self.pos..end];
        self.pos = end;
        Ok(bytes)
    }

    fn array<const N: usize>(&mut self) -> Result<[u8; N], String> {
        Ok(self.take(N)?.try_into().map_err(|_| "truncated snapshot")?)
    }

    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.take(1)?[0])
    }

    fn u16(&mut self) -> Result<u16, String> {
        Ok(u16::from_le_bytes(self.array()?))
    }

    fn u64(&mut self) -> Result<u64, String> {
        Ok(u64::from_le_bytes(self.array()?))
    }
}

pub fn decode(data: &[u8]) -> Result<Snapshot, String> {
    let mut r = Reader { data, pos: 0 };
    if r.take(MAGIC.len())? != MAGIC {
        return Err("not a tracker snapshot".into());
    }
    let version = r.u8()?;
    if version != VERSION {
        return Err(format!("unsupported snapshot version {version}"));
    }
    let saved_at = r.u64()?;
    let count = r.u64()?;
    // Each entry is at least 90 bytes: never trust the count for allocation
    let mut entries = Vec::with_capacity((count as usize).min(data.len() / 90));
    for _ in 0..count {
        let info_hash = r.array()?;
        let peer_id = r.array()?;
        let id_len = r.u16()? as usize;
        let user_id = String::from_utf8(r.take(id_len)?.to_vec()).map_err(|_| "invalid user id")?;
        let ip = match r.u8()? {
            4 => IpAddr::V4(Ipv4Addr::from(r.array::<4>()?)),
            6 => IpAddr::V6(Ipv6Addr::from(r.array::<16>()?)),
            other => return Err(format!("invalid ip tag {other}")),
        };
        let port = r.u16()?;
        let uploaded = r.u64()?;
        let downloaded = r.u64()?;
        let has_left = r.u8()? == 1;
        let left = r.u64()?;
        let updated_at = r.u64()?;
        let seeder = r.u8()? == 1;
        entries.push(Entry {
            info_hash,
            peer_id,
            user_id,
            peer: Peer {
                owner: 0,
                ip,
                port,
                uploaded,
                downloaded,
                left: has_left.then_some(left),
                updated_at,
            },
            seeder,
        });
    }
    if r.pos != data.len() {
        return Err("trailing bytes in snapshot".into());
    }
    Ok(Snapshot { saved_at, entries })
}

/// Live entries only: peers past the TTL are gone anyway
pub fn live(entries: Vec<Entry>, now: u64) -> Vec<Entry> {
    entries
        .into_iter()
        .filter(|e| now.saturating_sub(e.peer.updated_at) < PEER_TTL_MS)
        .collect()
}

/// Write atomically (a crash mid-write never leaves a half file to load),
/// readable by the tracker user only: the file holds raw peer IPs.
pub fn save(path: &Path, bytes: &[u8]) -> std::io::Result<()> {
    use std::io::Write;
    let tmp = path.with_extension("tmp");
    let mut options = std::fs::OpenOptions::new();
    options.write(true).create(true).truncate(true);
    #[cfg(unix)]
    std::os::unix::fs::OpenOptionsExt::mode(&mut options, 0o600);
    options.open(&tmp)?.write_all(bytes)?;
    std::fs::rename(&tmp, path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(n: u8, ip: &str, left: Option<u64>, updated_at: u64) -> Entry {
        Entry {
            info_hash: [n; 20],
            peer_id: [n + 1; 20],
            user_id: format!("user-{n}"),
            peer: Peer {
                owner: 0,
                ip: ip.parse().unwrap(),
                port: 6881,
                uploaded: 1 << 40,
                downloaded: 12345,
                left,
                updated_at,
            },
            seeder: left == Some(0),
        }
    }

    #[test]
    fn round_trip() {
        let entries = vec![
            entry(1, "203.0.113.5", Some(0), 1000),
            entry(2, "2001:db8::1", None, 2000),
            entry(3, "10.0.0.1", Some(77), 3000),
        ];
        let snapshot = decode(&encode(42, &entries)).unwrap();
        assert_eq!(snapshot.saved_at, 42);
        assert_eq!(snapshot.entries, entries);
    }

    #[test]
    fn rejects_bad_files() {
        let good = encode(1, &[entry(1, "10.0.0.1", Some(0), 1)]);
        assert!(decode(b"garbage").is_err());
        assert!(decode(&good[..good.len() - 3]).is_err(), "truncated");
        let mut extra = good.clone();
        extra.push(0);
        assert!(decode(&extra).is_err(), "trailing bytes");
        let mut version = good.clone();
        version[7] = 99;
        assert!(decode(&version).unwrap_err().contains("version"));
        // A huge count with no data must not allocate or panic
        let mut huge = encode(1, &[]);
        huge[16..24].copy_from_slice(&u64::MAX.to_le_bytes());
        assert!(decode(&huge).is_err());
    }

    #[test]
    fn drops_expired_peers() {
        let entries = vec![
            entry(1, "10.0.0.1", Some(0), 0),
            entry(2, "10.0.0.2", Some(0), PEER_TTL_MS),
        ];
        let kept = live(entries, PEER_TTL_MS + 1);
        assert_eq!(kept.len(), 1);
        assert_eq!(kept[0].info_hash, [2; 20]);
    }

    #[test]
    fn saves_atomically() {
        let dir = std::env::temp_dir().join(format!("trk-snap-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("swarms.bin");
        save(&path, b"data").unwrap();
        assert_eq!(std::fs::read(&path).unwrap(), b"data");
        assert!(!path.with_extension("tmp").exists());
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = std::fs::metadata(&path).unwrap().permissions().mode();
            assert_eq!(mode & 0o777, 0o600);
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}
