//! Announce/scrape query parsing.
//!
//! `info_hash` and `peer_id` are 20 raw bytes, percent-encoded: the query
//! string cannot go through a UTF-8 decoder, so it is decoded to bytes here.

pub const DEFAULT_NUMWANT: usize = 50;
pub const MAX_NUMWANT: usize = 82;
pub const MAX_SCRAPE_HASHES: usize = 100;

pub type Hash = [u8; 20];

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Event {
    Started,
    Stopped,
    Completed,
    Update,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct AnnounceRequest {
    pub info_hash: Hash,
    pub peer_id: Hash,
    pub port: u16,
    pub uploaded: u64,
    pub downloaded: u64,
    /// `None` when missing or unreadable: the peer is treated as a leecher
    pub left: Option<u64>,
    pub event: Event,
    pub compact: bool,
    pub numwant: usize,
    pub passkey: Option<String>,
}

impl AnnounceRequest {
    pub fn is_seeder(&self) -> bool {
        self.left == Some(0)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScrapeRequest {
    pub info_hashes: Vec<Hash>,
    pub passkey: Option<String>,
}

/// Decoded `key=value` pairs, in order, repeated keys kept.
pub struct Params(Vec<(Vec<u8>, Vec<u8>)>);

impl Params {
    pub fn parse(query: &str) -> Self {
        let pairs = query
            .split('&')
            .filter(|part| !part.is_empty())
            .map(|part| {
                let (key, value) = part.split_once('=').unwrap_or((part, ""));
                (decode(key), decode(value))
            })
            .collect();
        Params(pairs)
    }

    fn get(&self, key: &str) -> Option<&[u8]> {
        self.0
            .iter()
            .find(|(k, _)| k == key.as_bytes())
            .map(|(_, v)| v.as_slice())
    }

    fn get_all<'a>(&'a self, key: &'a str) -> impl Iterator<Item = &'a [u8]> + 'a {
        self.0
            .iter()
            .filter(move |(k, _)| k == key.as_bytes())
            .map(|(_, v)| v.as_slice())
    }

    fn get_str(&self, key: &str) -> Option<&str> {
        self.get(key).and_then(|v| std::str::from_utf8(v).ok())
    }

    fn get_u64(&self, key: &str) -> Option<u64> {
        self.get_str(key).and_then(|v| v.trim().parse().ok())
    }

    fn passkey(&self) -> Option<String> {
        self.get_str("passkey")
            .filter(|p| !p.is_empty())
            .map(str::to_owned)
    }
}

/// Percent-decode to raw bytes; `+` is a space (form encoding).
fn decode(input: &str) -> Vec<u8> {
    let bytes = input.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                match (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                    (Some(hi), Some(lo)) => {
                        out.push(hi << 4 | lo);
                        i += 3;
                        continue;
                    }
                    _ => out.push(b'%'),
                }
            }
            b'+' => out.push(b' '),
            byte => out.push(byte),
        }
        i += 1;
    }
    out
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn to_hash(bytes: &[u8]) -> Option<Hash> {
    bytes.try_into().ok()
}

pub fn parse_announce(params: &Params) -> Result<AnnounceRequest, &'static str> {
    let info_hash = params
        .get("info_hash")
        .and_then(to_hash)
        .ok_or("invalid info_hash")?;
    let peer_id = params
        .get("peer_id")
        .and_then(to_hash)
        .ok_or("invalid peer_id")?;
    let port = params
        .get_u64("port")
        .filter(|p| (1..=65535).contains(p))
        .ok_or("invalid port")? as u16;

    let event = match params.get_str("event") {
        Some("started") => Event::Started,
        Some("stopped") => Event::Stopped,
        Some("completed") => Event::Completed,
        _ => Event::Update,
    };
    let numwant = params
        .get_u64("numwant")
        .filter(|&n| n > 0)
        .map_or(DEFAULT_NUMWANT, |n| (n as usize).min(MAX_NUMWANT));

    Ok(AnnounceRequest {
        info_hash,
        peer_id,
        port,
        uploaded: params.get_u64("uploaded").unwrap_or(0),
        downloaded: params.get_u64("downloaded").unwrap_or(0),
        left: params.get_u64("left"),
        event,
        compact: params.get_str("compact") == Some("1"),
        numwant,
        passkey: params.passkey(),
    })
}

pub fn parse_scrape(params: &Params) -> Result<ScrapeRequest, &'static str> {
    let info_hashes = params
        .get_all("info_hash")
        .map(to_hash)
        .collect::<Option<Vec<_>>>()
        .ok_or("invalid info_hash")?;
    Ok(ScrapeRequest {
        info_hashes,
        passkey: params.passkey(),
    })
}

pub fn to_hex(hash: &Hash) -> String {
    const DIGITS: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(40);
    for byte in hash {
        out.push(DIGITS[(byte >> 4) as usize] as char);
        out.push(DIGITS[(byte & 0xf) as usize] as char);
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH_ENC: &str = "%124Vx%9A%BC%DE%F1%23Eg%89%AB%CD%EF%124Vx%9A";
    const HASH: Hash = [
        0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf1, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef,
        0x12, 0x34, 0x56, 0x78, 0x9a,
    ];
    const PEER: &str = "-qB4650-abcdefghijkl";

    fn announce(query: &str) -> Result<AnnounceRequest, &'static str> {
        parse_announce(&Params::parse(query))
    }

    #[test]
    fn decodes_binary_info_hash() {
        let req = announce(&format!(
            "info_hash={HASH_ENC}&peer_id={PEER}&port=6881&uploaded=10&downloaded=20&left=0&event=started&compact=1&passkey=abc"
        ))
        .unwrap();
        assert_eq!(req.info_hash, HASH);
        assert_eq!(&req.peer_id, PEER.as_bytes());
        assert_eq!(req.port, 6881);
        assert_eq!((req.uploaded, req.downloaded, req.left), (10, 20, Some(0)));
        assert_eq!(req.event, Event::Started);
        assert!(req.compact && req.is_seeder());
        assert_eq!(req.numwant, DEFAULT_NUMWANT);
        assert_eq!(req.passkey.as_deref(), Some("abc"));
        assert_eq!(
            to_hex(&req.info_hash),
            "123456789abcdef123456789abcdef123456789a"
        );
    }

    #[test]
    fn rejects_bad_fields() {
        let base = format!("info_hash={HASH_ENC}&peer_id={PEER}");
        assert_eq!(announce(&format!("{base}&port=0")), Err("invalid port"));
        assert_eq!(announce(&format!("{base}&port=70000")), Err("invalid port"));
        assert_eq!(announce(&base), Err("invalid port"));
        assert_eq!(
            announce(&format!("info_hash=short&peer_id={PEER}&port=1")),
            Err("invalid info_hash")
        );
        assert_eq!(
            announce(&format!("info_hash={HASH_ENC}&peer_id=x&port=1")),
            Err("invalid peer_id")
        );
    }

    #[test]
    fn defaults_and_limits() {
        let base = format!("info_hash={HASH_ENC}&peer_id={PEER}&port=1");
        let req = announce(&format!(
            "{base}&left=abc&uploaded=-5&event=paused&numwant=500"
        ))
        .unwrap();
        assert_eq!(req.left, None);
        assert!(!req.is_seeder());
        assert_eq!(req.uploaded, 0);
        assert_eq!(req.event, Event::Update);
        assert_eq!(req.numwant, MAX_NUMWANT);
        assert!(!req.compact);
        assert_eq!(req.passkey, None);
        assert_eq!(
            announce(&format!("{base}&numwant=0")).unwrap().numwant,
            DEFAULT_NUMWANT
        );
        assert_eq!(announce(&format!("{base}&numwant=10")).unwrap().numwant, 10);
    }

    #[test]
    fn plus_and_broken_escapes() {
        assert_eq!(decode("a+b"), b"a b");
        assert_eq!(decode("%2"), b"%2");
        assert_eq!(decode("%zz"), b"%zz");
        assert_eq!(decode("100%"), b"100%");
        assert_eq!(decode("%41%42"), b"AB");
    }

    #[test]
    fn scrape_collects_repeated_hashes() {
        let req = parse_scrape(&Params::parse(&format!(
            "passkey=k&info_hash={HASH_ENC}&info_hash={HASH_ENC}"
        )))
        .unwrap();
        assert_eq!(req.info_hashes, vec![HASH, HASH]);
        assert_eq!(req.passkey.as_deref(), Some("k"));
        assert!(parse_scrape(&Params::parse("info_hash=bad")).is_err());
        assert!(
            parse_scrape(&Params::parse(""))
                .unwrap()
                .info_hashes
                .is_empty()
        );
    }
}
