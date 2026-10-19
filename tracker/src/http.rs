//! Public HTTP endpoints: `/announce` and `/scrape`.

use std::net::SocketAddr;
use std::sync::Arc;

use axum::Router;
use axum::extract::{ConnectInfo, RawQuery, State};
use axum::http::{HeaderMap, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::get;

use crate::client_ip::client_ip;
use crate::query::{self, MAX_SCRAPE_HASHES, Params};
use crate::response;
use crate::tracker::Tracker;

pub fn router(tracker: Arc<Tracker>) -> Router {
    Router::new()
        .route("/announce", get(announce))
        .route("/scrape", get(scrape))
        .with_state(tracker)
}

/// Clients read the reason from the body, so failures are sent with 200.
fn bencoded(body: Vec<u8>) -> Response {
    (StatusCode::OK, [(header::CONTENT_TYPE, "text/plain")], body).into_response()
}

fn fail(reason: &str) -> Response {
    bencoded(response::failure(reason))
}

async fn announce(
    State(tracker): State<Arc<Tracker>>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> Response {
    let params = Params::parse(raw.as_deref().unwrap_or(""));
    let request = match query::parse_announce(&params) {
        Ok(request) => request,
        Err(reason) => return fail(reason),
    };
    let forwarded = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok());
    let Some(ip) = client_ip(remote, forwarded, tracker.config.trusted_hops) else {
        return fail("invalid ip");
    };
    bencoded(tracker.announce(&request, ip).await)
}

async fn scrape(
    State(tracker): State<Arc<Tracker>>,
    ConnectInfo(remote): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    RawQuery(raw): RawQuery,
) -> Response {
    let params = Params::parse(raw.as_deref().unwrap_or(""));
    let request = match query::parse_scrape(&params) {
        Ok(request) => request,
        Err(reason) => return fail(reason),
    };
    if request.passkey.is_none() {
        return fail("Passkey required");
    }
    if request.info_hashes.is_empty() {
        return fail("info_hash required");
    }
    if request.info_hashes.len() > MAX_SCRAPE_HASHES {
        return fail("Too many info_hash values");
    }
    let forwarded = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok());
    let Some(ip) = client_ip(remote, forwarded, tracker.config.trusted_hops) else {
        return fail("invalid ip");
    };
    bencoded(tracker.scrape(&request, ip).await)
}
