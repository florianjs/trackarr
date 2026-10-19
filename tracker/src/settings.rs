//! Admin settings the tracker depends on, from the `settings` table.
//! Parsing and defaults mirror `server/utils/settings.ts`.

use std::collections::HashMap;

use chrono::{DateTime, Utc};
use deadpool_postgres::Pool;

const KEYS: &[&str] = &[
    "min_ratio",
    "freeleech_enabled",
    "freeleech_until",
    "bonus_enabled",
    "bonus_points_per_seed_day",
    "bonus_max_seeding_torrents",
    "hnr_enabled",
    "hnr_required_seed_time",
];

#[derive(Debug, Clone, PartialEq)]
pub struct Settings {
    pub min_ratio: f64,
    pub freeleech_enabled: bool,
    pub freeleech_until: Option<String>,
    pub bonus_enabled: bool,
    pub bonus_points_per_seed_day: f64,
    pub bonus_max_seeding_torrents: usize,
    pub hnr_enabled: bool,
    pub hnr_required_seed_time: i32,
}

impl Default for Settings {
    fn default() -> Self {
        Settings::from_map(&HashMap::new())
    }
}

/// `parseNumberSetting`: finite and non-negative, else the fallback
fn number(value: Option<&String>, fallback: f64) -> f64 {
    value
        .and_then(|v| v.trim().parse::<f64>().ok())
        .filter(|n| n.is_finite() && *n >= 0.0)
        .unwrap_or(fallback)
}

impl Settings {
    pub fn from_map(map: &HashMap<String, String>) -> Self {
        Settings {
            min_ratio: map
                .get("min_ratio")
                .and_then(|v| v.trim().parse::<f64>().ok())
                .filter(|n| n.is_finite())
                .unwrap_or(0.0),
            freeleech_enabled: map.get("freeleech_enabled").map(String::as_str) == Some("true"),
            freeleech_until: map
                .get("freeleech_until")
                .filter(|v| !v.is_empty())
                .cloned(),
            bonus_enabled: map.get("bonus_enabled").map(String::as_str) != Some("false"),
            bonus_points_per_seed_day: number(map.get("bonus_points_per_seed_day"), 10.0),
            bonus_max_seeding_torrents: number(map.get("bonus_max_seeding_torrents"), 100.0).floor()
                as usize,
            hnr_enabled: map.get("hnr_enabled").map(String::as_str) == Some("true"),
            hnr_required_seed_time: map
                .get("hnr_required_seed_time")
                .and_then(|v| v.trim().parse().ok())
                .unwrap_or(86400),
        }
    }

    /// `isFreeleechActive`: an unreadable end date means no freeleech
    pub fn freeleech_active(&self, now: DateTime<Utc>) -> bool {
        if !self.freeleech_enabled {
            return false;
        }
        match &self.freeleech_until {
            None => true,
            Some(until) => DateTime::parse_from_rfc3339(until).is_ok_and(|end| now < end),
        }
    }

    pub async fn load(pool: &Pool) -> Result<Self, String> {
        let client = pool.get().await.map_err(|e| e.to_string())?;
        let statement = client
            .prepare_cached("SELECT key, value FROM settings WHERE key = ANY($1)")
            .await
            .map_err(|e| e.to_string())?;
        let rows = client
            .query(&statement, &[&KEYS])
            .await
            .map_err(|e| e.to_string())?;
        let map = rows
            .iter()
            .map(|row| (row.get::<_, String>(0), row.get::<_, String>(1)))
            .collect();
        Ok(Settings::from_map(&map))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(pairs: &[(&str, &str)]) -> Settings {
        Settings::from_map(
            &pairs
                .iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        )
    }

    #[test]
    fn defaults_match_node() {
        let s = Settings::default();
        assert_eq!(s.min_ratio, 0.0);
        assert!(!s.freeleech_enabled);
        assert!(s.bonus_enabled);
        assert_eq!(s.bonus_points_per_seed_day, 10.0);
        assert_eq!(s.bonus_max_seeding_torrents, 100);
        assert!(!s.hnr_enabled);
        assert_eq!(s.hnr_required_seed_time, 86400);
    }

    #[test]
    fn parses_values() {
        let s = settings(&[
            ("min_ratio", "0.5"),
            ("bonus_enabled", "false"),
            ("bonus_points_per_seed_day", "-3"),
            ("bonus_max_seeding_torrents", "12.7"),
            ("hnr_enabled", "true"),
            ("hnr_required_seed_time", "3600"),
        ]);
        assert_eq!(s.min_ratio, 0.5);
        assert!(!s.bonus_enabled);
        assert_eq!(s.bonus_points_per_seed_day, 10.0, "negative falls back");
        assert_eq!(s.bonus_max_seeding_torrents, 12);
        assert!(s.hnr_enabled);
        assert_eq!(s.hnr_required_seed_time, 3600);
    }

    #[test]
    fn freeleech_window() {
        let now = DateTime::parse_from_rfc3339("2026-10-19T12:00:00.000Z")
            .unwrap()
            .with_timezone(&Utc);
        assert!(!settings(&[]).freeleech_active(now));
        assert!(settings(&[("freeleech_enabled", "true")]).freeleech_active(now));
        assert!(
            settings(&[("freeleech_enabled", "true"), ("freeleech_until", "")])
                .freeleech_active(now)
        );
        assert!(
            settings(&[
                ("freeleech_enabled", "true"),
                ("freeleech_until", "2026-10-19T13:00:00.000Z")
            ])
            .freeleech_active(now)
        );
        assert!(
            !settings(&[
                ("freeleech_enabled", "true"),
                ("freeleech_until", "2026-10-19T11:00:00.000Z")
            ])
            .freeleech_active(now)
        );
        assert!(
            !settings(&[
                ("freeleech_enabled", "true"),
                ("freeleech_until", "garbage")
            ])
            .freeleech_active(now)
        );
    }
}
