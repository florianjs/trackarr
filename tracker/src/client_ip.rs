//! Address peers are announced with: the TCP peer, or the first
//! `X-Forwarded-For` entry when a trusted reverse proxy sits in front.

use std::net::{IpAddr, SocketAddr};

pub fn client_ip(
    remote: SocketAddr,
    forwarded_for: Option<&str>,
    trust_proxy: bool,
) -> Option<IpAddr> {
    let ip = match forwarded_for {
        Some(header) if trust_proxy => header.split(',').next()?.trim().parse().ok()?,
        _ => remote.ip(),
    };
    // IPv4 clients on a dual-stack socket show up as ::ffff:a.b.c.d
    Some(ip.to_canonical())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn remote(s: &str) -> SocketAddr {
        s.parse().unwrap()
    }

    #[test]
    fn uses_first_forwarded_entry_when_trusted() {
        let ip = client_ip(remote("127.0.0.1:1"), Some("203.0.113.5, 10.0.0.1"), true);
        assert_eq!(ip, Some("203.0.113.5".parse().unwrap()));
    }

    #[test]
    fn ignores_header_when_untrusted() {
        let ip = client_ip(remote("198.51.100.7:1"), Some("203.0.113.5"), false);
        assert_eq!(ip, Some("198.51.100.7".parse().unwrap()));
    }

    #[test]
    fn falls_back_to_socket_without_header() {
        assert_eq!(
            client_ip(remote("198.51.100.7:1"), None, true),
            Some("198.51.100.7".parse().unwrap())
        );
    }

    #[test]
    fn unmaps_ipv4_mapped_ipv6() {
        assert_eq!(
            client_ip(remote("[::ffff:198.51.100.7]:1"), None, false),
            Some("198.51.100.7".parse().unwrap())
        );
        assert_eq!(
            client_ip(remote("[2001:db8::1]:1"), None, false),
            Some("2001:db8::1".parse().unwrap())
        );
    }

    #[test]
    fn rejects_garbage_header() {
        assert_eq!(
            client_ip(remote("127.0.0.1:1"), Some("not-an-ip"), true),
            None
        );
    }
}
