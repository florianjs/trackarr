//! Who may announce (port of the `filter` in `server/tracker/index.ts`).
//! Pure: lookups are done by the caller.

use crate::lookups::{TrackerTorrent, TrackerUser};

#[derive(Debug, Clone, PartialEq)]
pub enum Access {
    Allowed,
    Denied(String),
    /// Ratio too low: allowed only if the peer is a seeder that really
    /// completed this torrent (`left` is client supplied). Holds the denial.
    NeedsSnatch(String),
}

pub fn check(
    user: Option<&TrackerUser>,
    torrent: Option<&TrackerTorrent>,
    min_ratio: f64,
    freeleech: bool,
) -> Access {
    let Some(user) = user else {
        return Access::Denied("Invalid passkey".into());
    };
    if user.is_banned {
        return Access::Denied("User is banned".into());
    }

    let torrent = torrent.filter(|t| t.is_active);
    let is_uploader = torrent
        .and_then(|t| t.uploader_id.as_ref())
        .is_some_and(|uploader| *uploader == user.id);
    // Pending torrents: only the uploader (to start seeding) and staff
    match torrent {
        Some(t) if t.is_approved || is_uploader || user.is_staff => {}
        _ => return Access::Denied("Torrent not found or inactive".into()),
    }

    // Suspended during a global freeleech: downloads do not count anyway
    if min_ratio > 0.0 && !is_uploader && !freeleech && user.downloaded > 0 {
        let ratio = user.uploaded as f64 / user.downloaded as f64;
        if ratio < min_ratio {
            return Access::NeedsSnatch(format!(
                "Low ratio ({ratio:.2} < {min_ratio}). Download disabled."
            ));
        }
    }
    Access::Allowed
}

#[cfg(test)]
mod tests {
    use std::sync::Arc;

    use super::*;

    fn user(uploaded: i64, downloaded: i64) -> TrackerUser {
        TrackerUser {
            id: Arc::from("u1"),
            owner: 0,
            is_banned: false,
            is_staff: false,
            uploaded,
            downloaded,
        }
    }

    fn torrent(approved: bool, uploader: &str) -> TrackerTorrent {
        TrackerTorrent {
            id: Arc::from("t1"),
            is_active: true,
            is_approved: approved,
            uploader_id: Some(Arc::from(uploader)),
        }
    }

    fn denied(reason: &str) -> Access {
        Access::Denied(reason.into())
    }

    #[test]
    fn unknown_or_banned_user() {
        assert_eq!(check(None, None, 0.0, false), denied("Invalid passkey"));
        let mut banned = user(0, 0);
        banned.is_banned = true;
        assert_eq!(
            check(Some(&banned), Some(&torrent(true, "x")), 0.0, false),
            denied("User is banned")
        );
    }

    #[test]
    fn torrent_visibility() {
        let u = user(0, 0);
        let missing = denied("Torrent not found or inactive");
        assert_eq!(check(Some(&u), None, 0.0, false), missing);
        let mut inactive = torrent(true, "x");
        inactive.is_active = false;
        assert_eq!(check(Some(&u), Some(&inactive), 0.0, false), missing);
        assert_eq!(
            check(Some(&u), Some(&torrent(false, "x")), 0.0, false),
            missing
        );
        assert_eq!(
            check(Some(&u), Some(&torrent(false, "u1")), 0.0, false),
            Access::Allowed
        );
        let mut staff = user(0, 0);
        staff.is_staff = true;
        assert_eq!(
            check(Some(&staff), Some(&torrent(false, "x")), 0.0, false),
            Access::Allowed
        );
    }

    #[test]
    fn ratio_rules() {
        let t = torrent(true, "x");
        let low = user(10, 100);
        assert_eq!(
            check(Some(&low), Some(&t), 0.5, false),
            Access::NeedsSnatch("Low ratio (0.10 < 0.5). Download disabled.".into())
        );
        assert_eq!(
            check(Some(&low), Some(&t), 0.5, true),
            Access::Allowed,
            "freeleech"
        );
        assert_eq!(
            check(Some(&low), Some(&torrent(true, "u1")), 0.5, false),
            Access::Allowed,
            "uploader"
        );
        assert_eq!(
            check(Some(&low), Some(&t), 0.0, false),
            Access::Allowed,
            "no minimum"
        );
        assert_eq!(
            check(Some(&user(0, 0)), Some(&t), 1.0, false),
            Access::Allowed,
            "nothing downloaded"
        );
        assert_eq!(
            check(Some(&user(60, 100)), Some(&t), 0.5, false),
            Access::Allowed
        );
        assert_eq!(
            check(Some(&low), Some(&t), 1.0, false),
            Access::NeedsSnatch("Low ratio (0.10 < 1). Download disabled.".into())
        );
    }
}
