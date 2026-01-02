# Load Testing

OpenTracker includes a built-in load testing suite to measure tracker performance under high concurrency.

## Quick Start

```bash
# Start the load test environment
docker compose -f docker-compose.loadtest.yml up -d --build

# Wait for the tracker to be ready
docker logs -f opentracker-loadtest

# Initialize the database (first time only)
docker exec opentracker-loadtest npm run db:push

# Run load tests
npm run test:load -- --peers 100 --duration 10
```

## Test Scenarios

| Scenario | Peers | Duration | Purpose |
|----------|-------|----------|---------|
| Smoke | 100 | 10s | Validate setup |
| Normal | 1,000 | 30s | Production-like load |
| Stress | 5,000 | 60s | Find breaking points |

### Smoke Test

Quick validation that everything works:

```bash
npm run test:load -- --peers 100 --duration 10
```

### Normal Load Test

Simulates typical production traffic:

```bash
npm run test:load -- --peers 1000 --duration 30
```

### Stress Test

Pushes the tracker to its limits:

```bash
npm run test:load -- --peers 5000 --duration 60 --torrents 100
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--url` | `http://localhost:8080` | Tracker URL |
| `--peers` | `100` | Number of simulated peers |
| `--torrents` | `10` | Number of torrents |
| `--duration` | `10` | Test duration (seconds) |
| `--interval` | `100` | Announce interval (ms) |
| `--rampup` | `2000` | Ramp-up time (ms) |

## Understanding Results

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  LOAD TEST RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Throughput:
    Total Requests:     1250
    Successful:         1250
    Failed:             0
    Error Rate:         0.00%
    Requests/sec:       125.00

  Latency (ms):
    P50:                12.34
    P95:                45.67
    P99:                89.12

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Key Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| Error Rate | < 1% | Percentage of failed requests |
| P99 Latency | < 500ms | 99th percentile response time |
| Requests/sec | > 100 | Throughput capacity |

## Pass/Fail Criteria

The test automatically passes or fails based on:

- **Error Rate** must be below 1%
- **P99 Latency** must be below 500ms

## Troubleshooting

### Connection Refused

The tracker isn't running or port 8080 isn't exposed.

```bash
docker logs opentracker-loadtest | grep "listening"
```

### High Error Rate

Check if the database schema is initialized:

```bash
docker exec opentracker-loadtest npm run db:push
```

### High Latency

Possible causes:
- Redis memory pressure
- PostgreSQL connection pool exhaustion
- Insufficient container resources

Monitor with:

```bash
docker stats
```
