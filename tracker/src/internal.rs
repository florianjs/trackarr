//! Private API for the web app and monitoring, on its own port that the
//! reverse proxy never exposes.
//!
//! - `GET /health`                  liveness, no auth
//! - `GET /metrics`                 Prometheus text, no auth (aggregates only)
//! - `GET /internal/status`         bearer token
//! - `GET /internal/swarms/{hash}`  bearer token; peers with hashed IPs only

use std::sync::Arc;
use std::sync::atomic::Ordering;

use axum::Json;
use axum::Router;
use axum::extract::{Path, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;
use chrono::Utc;
use serde::Serialize;

use crate::crypto::{hash_ip, secure_eq};
use crate::invalidate::parse_hex_hash;
use crate::tracker::{Tracker, now_ms};

pub struct InternalState {
    pub tracker: Arc<Tracker>,
    /// `None`: `/internal/*` is disabled
    pub token: Option<String>,
    pub ip_secret: String,
}

pub fn router(state: Arc<InternalState>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/metrics", get(metrics))
        .route("/internal/status", get(status))
        .route("/internal/swarms/{hash}", get(swarm))
        .with_state(state)
}

fn authorized(state: &InternalState, headers: &HeaderMap) -> Result<(), StatusCode> {
    let Some(token) = &state.token else {
        return Err(StatusCode::NOT_FOUND);
    };
    let given = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .unwrap_or("");
    if secure_eq(given.as_bytes(), token.as_bytes()) {
        Ok(())
    } else {
        Err(StatusCode::UNAUTHORIZED)
    }
}

async fn health() -> &'static str {
    "ok"
}

async fn metrics(State(state): State<Arc<InternalState>>) -> Response {
    let tracker = &state.tracker;
    let (swarms, seeders, leechers) = tracker.swarms.totals();
    let counters = &tracker.limiter.counters;
    let body = format!(
        "# TYPE trackarr_tracker_announces_total counter\n\
         trackarr_tracker_announces_total {}\n\
         # TYPE trackarr_tracker_swarms gauge\n\
         trackarr_tracker_swarms {swarms}\n\
         # TYPE trackarr_tracker_peers gauge\n\
         trackarr_tracker_peers{{type=\"seeder\"}} {seeders}\n\
         trackarr_tracker_peers{{type=\"leecher\"}} {leechers}\n\
         # TYPE trackarr_tracker_pending_accounting gauge\n\
         trackarr_tracker_pending_accounting {}\n\
         # TYPE trackarr_tracker_published gauge\n\
         trackarr_tracker_published {}\n\
         # TYPE trackarr_tracker_uptime_seconds gauge\n\
         trackarr_tracker_uptime_seconds {}\n\
         # TYPE trackarr_tracker_rejected_total counter\n\
         trackarr_tracker_rejected_total{{reason=\"invalid_passkey\"}} {}\n\
         trackarr_tracker_rejected_total{{reason=\"unknown_torrent\"}} {}\n\
         trackarr_tracker_rejected_total{{reason=\"too_many_peers\"}} {}\n\
         trackarr_tracker_rejected_total{{reason=\"blocked_client\"}} {}\n\
         # TYPE trackarr_tracker_blocked_clients gauge\n\
         trackarr_tracker_blocked_clients {}\n",
        tracker.announces.load(Ordering::Relaxed),
        tracker.ledger.pending_len(),
        u8::from(tracker.is_synced()),
        tracker.uptime_ms() / 1000,
        counters.invalid_passkey.load(Ordering::Relaxed),
        counters.unknown_torrent.load(Ordering::Relaxed),
        counters.too_many_peers.load(Ordering::Relaxed),
        counters.blocked.load(Ordering::Relaxed),
        tracker.limiter.blocked_clients(now_ms()),
    );
    ([(header::CONTENT_TYPE, "text/plain; version=0.0.4")], body).into_response()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Status {
    uptime_seconds: u64,
    announces: u64,
    swarms: u64,
    seeders: u64,
    leechers: u64,
    pending_accounting: usize,
    /// Counters have been published to Redis since start (warm-up over)
    published: bool,
}

async fn status(State(state): State<Arc<InternalState>>, headers: HeaderMap) -> Response {
    if let Err(denied) = authorized(&state, &headers) {
        return denied.into_response();
    }
    let tracker = &state.tracker;
    let (swarms, seeders, leechers) = tracker.swarms.totals();
    Json(Status {
        uptime_seconds: tracker.uptime_ms() / 1000,
        announces: tracker.announces.load(Ordering::Relaxed),
        swarms,
        seeders,
        leechers,
        pending_accounting: tracker.ledger.pending_len(),
        published: tracker.is_synced(),
    })
    .into_response()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SwarmPeer {
    ip_hash: String,
    port: u16,
    is_seeder: bool,
    uploaded: u64,
    downloaded: u64,
    left: Option<u64>,
    updated_at: u64,
}

#[derive(Serialize)]
struct Swarm {
    seeders: u32,
    leechers: u32,
    peers: Vec<SwarmPeer>,
}

async fn swarm(
    State(state): State<Arc<InternalState>>,
    headers: HeaderMap,
    Path(hash): Path<String>,
) -> Response {
    if let Err(denied) = authorized(&state, &headers) {
        return denied.into_response();
    }
    let Some(info_hash) = parse_hex_hash(&hash) else {
        return (StatusCode::BAD_REQUEST, "invalid info hash").into_response();
    };
    let now = Utc::now();
    let peers: Vec<SwarmPeer> = state
        .tracker
        .swarms
        .peers(&info_hash)
        .into_iter()
        .map(|(peer, is_seeder)| SwarmPeer {
            ip_hash: hash_ip(&state.ip_secret, peer.ip, now),
            port: peer.port,
            is_seeder,
            uploaded: peer.uploaded,
            downloaded: peer.downloaded,
            left: peer.left,
            updated_at: peer.updated_at,
        })
        .collect();
    let (seeders, leechers) = state.tracker.swarms.counts(&info_hash);
    Json(Swarm {
        seeders,
        leechers,
        peers,
    })
    .into_response()
}
