mod abuse;
mod bencode;
mod client_ip;
mod config;
mod credit;
mod crypto;
mod db;
mod dedupe;
mod http;
mod internal;
mod invalidate;
mod ledger;
mod lookups;
mod owners;
mod publish;
mod query;
mod redis_store;
mod response;
mod rules;
mod server;
mod settings;
mod snapshot;
mod swarms;
mod tracker;

use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use tokio::net::TcpListener;
use tracing_subscriber::EnvFilter;

use crate::config::Config;
use crate::tracker::Tracker;

fn exit_with(message: impl std::fmt::Display) -> ! {
    tracing::error!("{message}");
    std::process::exit(1);
}

/// `trackarr-tracker --healthcheck`: for Docker, the image has no shell or curl
async fn healthcheck() -> ! {
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    let port = std::env::var("TRACKER_INTERNAL_PORT").unwrap_or_else(|_| "8090".into());
    let check = async {
        let mut stream = tokio::net::TcpStream::connect(format!("127.0.0.1:{port}")).await?;
        stream
            .write_all(b"GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")
            .await?;
        let mut response = Vec::new();
        stream.read_to_end(&mut response).await?;
        Ok::<bool, std::io::Error>(response.starts_with(b"HTTP/1.1 200"))
    };
    match tokio::time::timeout(Duration::from_secs(3), check).await {
        Ok(Ok(true)) => std::process::exit(0),
        _ => std::process::exit(1),
    }
}

#[tokio::main]
async fn main() {
    if std::env::args().nth(1).as_deref() == Some("--healthcheck") {
        healthcheck().await;
    }
    let debug = std::env::var("TRACKER_DEBUG").as_deref() == Ok("true");
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                // Crate only: driver debug logs print query parameters (passkeys)
                .unwrap_or_else(|_| {
                    EnvFilter::new(if debug {
                        "info,trackarr_tracker=debug"
                    } else {
                        "info"
                    })
                }),
        )
        .init();

    let config = Config::from_env().unwrap_or_else(|err| exit_with(err));
    let pool = db::pool().unwrap_or_else(|err| exit_with(err));
    let redis = redis_store::RedisStore::from_env().unwrap_or_else(|err| exit_with(err));
    let ip_secret = crypto::ip_hash_secret().unwrap_or_else(|err| exit_with(err));
    let internal_token = config::read_secret("TRACKER_INTERNAL_TOKEN");
    let tracker = Arc::new(Tracker::new(config, pool, redis));

    // Ratio and freeleech rules depend on settings: never serve on defaults
    while let Err(err) = tracker.reload_settings().await {
        tracing::warn!("waiting for the database: {err}");
        tokio::time::sleep(Duration::from_secs(2)).await;
    }
    if let Some(path) = &tracker.config.snapshot_path {
        match tracker.load_snapshot(path) {
            Ok(0) => {}
            Ok(count) => tracing::info!("restored {count} peers from {}", path.display()),
            Err(err) => tracing::warn!("snapshot {} ignored: {err}", path.display()),
        }
    }
    tracker::spawn_jobs(tracker.clone());
    invalidate::spawn_subscriber(tracker.clone());

    if internal_token.is_none() {
        tracing::warn!("TRACKER_INTERNAL_TOKEN not set: /internal API disabled");
    }
    let internal_addr = SocketAddr::from(([0u16; 8], tracker.config.internal_port));
    let internal_listener = TcpListener::bind(internal_addr)
        .await
        .unwrap_or_else(|err| exit_with(format!("cannot listen on {internal_addr}: {err}")));
    let internal_app = internal::router(Arc::new(internal::InternalState {
        tracker: tracker.clone(),
        token: internal_token,
        ip_secret,
    }));
    let limits = tracker.config.limits;
    tokio::spawn(server::serve(
        internal_listener,
        internal_app,
        limits,
        std::future::pending(),
    ));
    tracing::info!("internal API listening on port {}", internal_addr.port());

    // Dual-stack listener: IPv4 clients arrive as ::ffff:a.b.c.d
    let port = tracker.config.http_port;
    let addr = SocketAddr::from(([0u16; 8], port));
    let listener = TcpListener::bind(addr)
        .await
        .unwrap_or_else(|err| exit_with(format!("cannot listen on {addr}: {err}")));
    tracing::info!("HTTP listening on port {port}");

    server::serve(
        listener,
        http::router(tracker.clone()),
        limits,
        shutdown_signal(),
    )
    .await;

    // Credit earned since the last flush must not be lost on restart
    tracker.flush().await;
    if let Some(path) = &tracker.config.snapshot_path {
        match tracker.save_snapshot(path) {
            Ok(count) => tracing::info!("saved {count} peers to {}", path.display()),
            Err(err) => tracing::error!("snapshot not saved to {}: {err}", path.display()),
        }
    }
    tracing::info!("stopped");
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            Ok(mut signal) => {
                signal.recv().await;
            }
            Err(_) => std::future::pending().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
