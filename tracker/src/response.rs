//! Bencoded tracker responses (BEP 3, BEP 23 compact peers, BEP 7 IPv6, BEP 48 scrape).

use std::net::IpAddr;

use crate::bencode::Value;
use crate::query::Hash;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResponsePeer {
    pub peer_id: Hash,
    pub ip: IpAddr,
    pub port: u16,
}

pub struct ScrapeEntry {
    pub info_hash: Hash,
    pub complete: u32,
    pub incomplete: u32,
    pub downloaded: u32,
}

pub fn failure(reason: &str) -> Vec<u8> {
    Value::dict([("failure reason", Value::str(reason))]).encode()
}

pub fn announce(
    interval: u32,
    complete: u32,
    incomplete: u32,
    peers: &[ResponsePeer],
    compact: bool,
) -> Vec<u8> {
    let mut entries = vec![
        ("interval", Value::Int(interval.into())),
        ("complete", Value::Int(complete.into())),
        ("incomplete", Value::Int(incomplete.into())),
    ];

    if compact {
        let mut v4 = Vec::new();
        let mut v6 = Vec::new();
        for peer in peers {
            match peer.ip {
                IpAddr::V4(ip) => {
                    v4.extend_from_slice(&ip.octets());
                    v4.extend_from_slice(&peer.port.to_be_bytes());
                }
                IpAddr::V6(ip) => {
                    v6.extend_from_slice(&ip.octets());
                    v6.extend_from_slice(&peer.port.to_be_bytes());
                }
            }
        }
        entries.push(("peers", Value::Bytes(v4)));
        entries.push(("peers6", Value::Bytes(v6)));
    } else {
        // Non-compact responses mix IPv4 and IPv6 in one list
        let list = peers
            .iter()
            .map(|peer| {
                Value::dict([
                    ("peer id", Value::Bytes(peer.peer_id.to_vec())),
                    ("ip", Value::str(&peer.ip.to_string())),
                    ("port", Value::Int(peer.port.into())),
                ])
            })
            .collect();
        entries.push(("peers", Value::List(list)));
    }

    Value::dict(entries).encode()
}

pub fn scrape(entries: &[ScrapeEntry]) -> Vec<u8> {
    let files = Value::dict(entries.iter().map(|entry| {
        (
            entry.info_hash,
            Value::dict([
                ("complete", Value::Int(entry.complete.into())),
                ("incomplete", Value::Int(entry.incomplete.into())),
                ("downloaded", Value::Int(entry.downloaded.into())),
            ]),
        )
    }));
    Value::dict([("files", files)]).encode()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn peer(ip: &str, port: u16) -> ResponsePeer {
        ResponsePeer {
            peer_id: *b"-qB4650-abcdefghijkl",
            ip: ip.parse().unwrap(),
            port,
        }
    }

    #[test]
    fn failure_reason() {
        assert_eq!(
            failure("Invalid passkey"),
            b"d14:failure reason15:Invalid passkeye"
        );
    }

    #[test]
    fn compact_splits_families() {
        let body = announce(600, 1, 2, &[peer("10.0.0.1", 6881), peer("::1", 80)], true);
        let mut expected = b"d8:completei1e10:incompletei2e8:intervali600e5:peers6:".to_vec();
        expected.extend_from_slice(&[10, 0, 0, 1, 0x1a, 0xe1]);
        expected.extend_from_slice(b"6:peers618:");
        expected.extend_from_slice(&[0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 80]);
        expected.push(b'e');
        assert_eq!(body, expected);
    }

    #[test]
    fn non_compact_lists_dicts() {
        let body = announce(600, 0, 1, &[peer("10.0.0.1", 6881)], false);
        assert_eq!(
            body,
            b"d8:completei0e10:incompletei1e8:intervali600e5:peersld2:ip8:10.0.0.17:peer id20:-qB4650-abcdefghijkl4:porti6881eeee"
        );
    }

    #[test]
    fn scrape_files_keyed_by_raw_hash() {
        let body = scrape(&[ScrapeEntry {
            info_hash: [b'a'; 20],
            complete: 3,
            incomplete: 4,
            downloaded: 5,
        }]);
        assert_eq!(
            body,
            b"d5:filesd20:aaaaaaaaaaaaaaaaaaaad8:completei3e10:downloadedi5e10:incompletei4eeee"
        );
    }
}
