# Trackarr tracker service: static musl binary on an empty image
FROM rust:1.95-alpine AS builder
RUN apk add --no-cache musl-dev
WORKDIR /build

# Dependencies first: cached until Cargo.toml / Cargo.lock change
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo 'fn main() {}' > src/main.rs \
    && cargo build --release --locked \
    && rm -rf src target/release/deps/trackarr_tracker* target/release/trackarr-tracker

COPY src ./src
RUN cargo build --release --locked
# Snapshot directory, owned by the runtime user (a new volume copies it)
RUN mkdir -p /out/data

FROM scratch
COPY --from=builder /build/target/release/trackarr-tracker /trackarr-tracker
COPY --from=builder --chown=65534:65534 /out/data /data
# nobody: no root inside the container
USER 65534:65534
ENV TRACKER_SNAPSHOT_PATH=/data/swarms.bin
VOLUME /data
EXPOSE 8080 8090
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD ["/trackarr-tracker", "--healthcheck"]
ENTRYPOINT ["/trackarr-tracker"]
