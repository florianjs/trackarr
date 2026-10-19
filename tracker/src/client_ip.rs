//! Address peers are announced with: the TCP peer, or an `X-Forwarded-For`
//! entry written by trusted reverse proxies.
//!
//! Each proxy appends the address it received the request from, so only the
//! rightmost `trusted_hops` entries are trustworthy; anything to their left
//! is client supplied. With `trusted_hops = 1` (Caddy alone) the last entry is
//! the client. Trusting the header on a port reachable without a proxy would
//! let a client announce any address, so it is off by default.

use std::net::{IpAddr, SocketAddr};

pub fn client_ip(
    remote: SocketAddr,
    forwarded_for: Option<&str>,
    trusted_hops: usize,
) -> Option<IpAddr> {
    let forwarded: Vec<&str> = match forwarded_for {
        Some(header) if trusted_hops > 0 => header.split(',').map(str::trim).collect(),
        _ => Vec::new(),
    };
    let ip = if trusted_hops > 0 && forwarded.len() >= trusted_hops {
        forwarded[forwarded.len() - trusted_hops].parse().ok()?
    } else {
        // No header, or fewer entries than trusted proxies: not set by them
        remote.ip()
    };
    // IPv4 clients on a dual-stack socket show up as ::ffff:a.b.c.d
    Some(ip.to_canonical())
}

/// `TRACKER_TRUST_PROXY`: `false`/unset = 0, `true` = 1, or a proxy count
pub fn parse_trusted_hops(value: Option<&str>) -> Result<usize, String> {
    match value.map(str::trim) {
        None | Some("") | Some("false") => Ok(0),
        Some("true") => Ok(1),
        Some(n) => n.parse().map_err(|_| {
            format!("TRACKER_TRUST_PROXY must be true, false or a proxy count: {n:?}")
        }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remote(s: &str) -> SocketAddr {
        s.parse().unwrap()
    }

    fn ip(s: &str) -> Option<IpAddr> {
        Some(s.parse().unwrap())
    }

    #[test]
    fn one_proxy_uses_the_last_entry() {
        // Caddy appends the real client: a spoofed entry on the left is ignored
        let got = client_ip(remote("10.0.0.2:1"), Some("6.6.6.6, 203.0.113.5"), 1);
        assert_eq!(got, ip("203.0.113.5"));
        assert_eq!(
            client_ip(remote("10.0.0.2:1"), Some("203.0.113.5"), 1),
            ip("203.0.113.5")
        );
    }

    #[test]
    fn two_proxies_skip_the_inner_one() {
        let got = client_ip(
            remote("10.0.0.2:1"),
            Some("6.6.6.6, 203.0.113.5, 172.16.0.9"),
            2,
        );
        assert_eq!(got, ip("203.0.113.5"));
    }

    #[test]
    fn too_few_entries_fall_back_to_the_socket() {
        let got = client_ip(remote("198.51.100.7:1"), Some("203.0.113.5"), 2);
        assert_eq!(got, ip("198.51.100.7"));
    }

    #[test]
    fn ignores_header_when_untrusted() {
        let got = client_ip(remote("198.51.100.7:1"), Some("203.0.113.5"), 0);
        assert_eq!(got, ip("198.51.100.7"));
    }

    #[test]
    fn falls_back_to_socket_without_header() {
        assert_eq!(
            client_ip(remote("198.51.100.7:1"), None, 1),
            ip("198.51.100.7")
        );
    }

    #[test]
    fn unmaps_ipv4_mapped_ipv6() {
        assert_eq!(
            client_ip(remote("[::ffff:198.51.100.7]:1"), None, 0),
            ip("198.51.100.7")
        );
        assert_eq!(
            client_ip(remote("[2001:db8::1]:1"), None, 0),
            ip("2001:db8::1")
        );
    }

    #[test]
    fn rejects_garbage_header() {
        assert_eq!(client_ip(remote("127.0.0.1:1"), Some("not-an-ip"), 1), None);
    }

    #[test]
    fn parses_trust_setting() {
        assert_eq!(parse_trusted_hops(None), Ok(0));
        assert_eq!(parse_trusted_hops(Some("false")), Ok(0));
        assert_eq!(parse_trusted_hops(Some("true")), Ok(1));
        assert_eq!(parse_trusted_hops(Some(" 2 ")), Ok(2));
        assert!(parse_trusted_hops(Some("yes")).is_err());
    }
}
