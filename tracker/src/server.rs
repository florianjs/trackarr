//! HTTP/1.1 accept loop with the limits `axum::serve` does not set: a
//! header read timeout (slow clients holding sockets open) and a cap on
//! simultaneous connections. Matters when the port is reachable without a
//! reverse proxy in front.

use std::future::Future;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::extract::ConnectInfo;
use hyper::body::Incoming;
use hyper::server::conn::http1;
use hyper_util::rt::{TokioIo, TokioTimer};
use hyper_util::server::graceful::GracefulShutdown;
use tokio::net::TcpListener;
use tokio::sync::Semaphore;
use tower::Service;

#[derive(Debug, Clone, Copy)]
pub struct Limits {
    /// Time a client gets to send a request's headers (also between keep-alive requests)
    pub header_timeout: Duration,
    pub max_connections: usize,
}

/// Longest wait for in-flight requests once shutdown starts
const DRAIN_TIMEOUT: Duration = Duration::from_secs(10);

pub async fn serve(
    listener: TcpListener,
    router: Router,
    limits: Limits,
    shutdown: impl Future<Output = ()>,
) {
    let permits = Arc::new(Semaphore::new(limits.max_connections.max(1)));
    let graceful = GracefulShutdown::new();
    let mut builder = http1::Builder::new();
    builder
        .timer(TokioTimer::new())
        .header_read_timeout(limits.header_timeout)
        .keep_alive(true);
    tokio::pin!(shutdown);

    loop {
        let (stream, remote) = tokio::select! {
            accepted = listener.accept() => match accepted {
                Ok(accepted) => accepted,
                Err(err) => {
                    // Out of file descriptors and similar: back off, keep serving
                    tracing::warn!("accept failed: {err}");
                    tokio::time::sleep(Duration::from_millis(50)).await;
                    continue;
                }
            },
            _ = &mut shutdown => break,
        };
        // Over the cap: close at once rather than queue unbounded sockets
        let Ok(permit) = permits.clone().try_acquire_owned() else {
            continue;
        };
        let _ = stream.set_nodelay(true);

        let router = router.clone();
        let service = hyper::service::service_fn(move |mut req: hyper::Request<Incoming>| {
            req.extensions_mut()
                .insert(ConnectInfo::<SocketAddr>(remote));
            router.clone().call(req)
        });
        let conn = graceful.watch(builder.serve_connection(TokioIo::new(stream), service));
        tokio::spawn(async move {
            let _ = conn.await;
            drop(permit);
        });
    }

    if tokio::time::timeout(DRAIN_TIMEOUT, graceful.shutdown())
        .await
        .is_err()
    {
        tracing::warn!("closing connections still open after {DRAIN_TIMEOUT:?}");
    }
}
