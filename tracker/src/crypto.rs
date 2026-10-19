//! IP hashing, identical to `hashIP` in `server/utils/crypto.ts`: SHA-256
//! with a daily salt, 16 hex chars. Raw IPs never leave the tracker.

use std::net::IpAddr;

use chrono::{DateTime, Utc};
use sha2::{Digest, Sha256};

use crate::config::read_secret;

/// Placeholder shipped in old `.env.example` files: public, so brute-forceable
const PLACEHOLDER_SECRET: &str = "trackarr-default-secret-change-me";

/// `IP_HASH_SECRET`, with the same production rules as the web app.
/// Outside production a random per-process secret is used when unset.
pub fn ip_hash_secret() -> Result<String, String> {
    let secret = read_secret("IP_HASH_SECRET");
    if std::env::var("NODE_ENV").as_deref() == Ok("production") {
        return match secret {
            Some(s) if s != PLACEHOLDER_SECRET && s.len() >= 32 => Ok(s),
            _ => {
                Err("IP_HASH_SECRET must be set to a random value of at least 32 characters".into())
            }
        };
    }
    Ok(secret.unwrap_or_else(|| {
        tracing::warn!("IP_HASH_SECRET not set, using a random dev secret");
        let mut bytes = [0u8; 32];
        bytes.iter_mut().for_each(|b| *b = fastrand::u8(..));
        hex(&bytes)
    }))
}

pub fn hash_ip(secret: &str, ip: IpAddr, now: DateTime<Utc>) -> String {
    let input = format!("{secret}:{}:{ip}", now.format("%Y-%m-%d"));
    let digest = Sha256::digest(input.as_bytes());
    hex(&digest[..8])
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

/// Constant-time comparison for the internal API token
pub fn secure_eq(a: &[u8], b: &[u8]) -> bool {
    a.len() == b.len() && a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_node_hash_ip() {
        // From Node: sha256("secret-value:2026-10-19:<ip>").slice(0, 16)
        let now = DateTime::parse_from_rfc3339("2026-10-19T23:30:00Z")
            .unwrap()
            .with_timezone(&Utc);
        assert_eq!(
            hash_ip("secret-value", "1.2.3.4".parse().unwrap(), now),
            "71c3fe563ea5b0b4"
        );
        assert_eq!(
            hash_ip("secret-value", "2001:db8::1".parse().unwrap(), now),
            "5dc880d82d939686"
        );
    }

    #[test]
    fn compares_tokens() {
        assert!(secure_eq(b"abc", b"abc"));
        assert!(!secure_eq(b"abc", b"abd"));
        assert!(!secure_eq(b"abc", b"ab"));
    }
}
